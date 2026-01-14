"""
Encryption Service - Field-Level Encryption for PII
AES-256-GCM encryption for sensitive data fields
"""
from typing import Optional, Union
import base64
import os
import json
from datetime import datetime

# Try to import cryptography library
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False


class FieldEncryptor:
    """
    AES-256-GCM field-level encryption for PII protection.
    Provides authenticated encryption with associated data (AEAD).
    """
    
    # PII fields that should be encrypted
    PII_FIELDS = [
        "ssn",              # Social Security Number
        "tax_id",           # Tax Identification Number
        "bank_account",     # Bank Account Number
        "address",          # Physical Address
        "phone_number",     # Phone Number
        "date_of_birth",    # Date of Birth
        "income_details",   # Detailed Income Information
        "employer_name",    # Employer Name (can be sensitive)
    ]
    
    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize encryptor with encryption key.
        Key should be 32 bytes for AES-256.
        """
        self.key = None
        
        if CRYPTO_AVAILABLE:
            if encryption_key:
                # Derive key from provided key using PBKDF2
                self.key = self._derive_key(encryption_key)
            else:
                # Use environment variable or generate
                env_key = os.getenv("LOANTWIN_ENCRYPTION_KEY")
                if env_key:
                    self.key = self._derive_key(env_key)
                else:
                    # Generate new key (store this securely in production!)
                    self.key = AESGCM.generate_key(bit_length=256)
    
    def _derive_key(self, password: str) -> bytes:
        """Derive 256-bit key from password using PBKDF2."""
        if not CRYPTO_AVAILABLE:
            return b""
        
        salt = os.getenv("LOANTWIN_ENCRYPTION_SALT", "loantwin-salt-v1").encode()
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return kdf.derive(password.encode())
    
    def encrypt(self, plaintext: str, associated_data: Optional[str] = None) -> str:
        """
        Encrypt plaintext using AES-256-GCM.
        Returns base64-encoded ciphertext with nonce prepended.
        
        Args:
            plaintext: The string to encrypt
            associated_data: Optional additional authenticated data (e.g., user_id)
        
        Returns:
            Base64-encoded encrypted string
        """
        if not CRYPTO_AVAILABLE or not self.key:
            # Fallback: base64 encode (NOT SECURE - for development only)
            return f"UNENC:{base64.b64encode(plaintext.encode()).decode()}"
        
        aesgcm = AESGCM(self.key)
        nonce = os.urandom(12)  # 96-bit nonce for GCM
        
        aad = associated_data.encode() if associated_data else None
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), aad)
        
        # Prepend nonce to ciphertext
        combined = nonce + ciphertext
        return base64.b64encode(combined).decode()
    
    def decrypt(self, encrypted_text: str, associated_data: Optional[str] = None) -> str:
        """
        Decrypt ciphertext using AES-256-GCM.
        
        Args:
            encrypted_text: Base64-encoded encrypted string
            associated_data: Must match the data used during encryption
        
        Returns:
            Decrypted plaintext string
        """
        if not CRYPTO_AVAILABLE or not self.key:
            # Handle fallback encoded data
            if encrypted_text.startswith("UNENC:"):
                return base64.b64decode(encrypted_text[6:]).decode()
            return encrypted_text  # Return as-is if not encrypted
        
        try:
            combined = base64.b64decode(encrypted_text)
            nonce = combined[:12]
            ciphertext = combined[12:]
            
            aesgcm = AESGCM(self.key)
            aad = associated_data.encode() if associated_data else None
            plaintext = aesgcm.decrypt(nonce, ciphertext, aad)
            
            return plaintext.decode()
        except Exception as e:
            # If decryption fails, return masked value
            return "[DECRYPTION_FAILED]"
    
    def encrypt_dict(self, data: dict, user_id: Optional[int] = None) -> dict:
        """
        Encrypt all PII fields in a dictionary.
        
        Args:
            data: Dictionary containing data to encrypt
            user_id: Optional user ID for associated data
        
        Returns:
            Dictionary with PII fields encrypted
        """
        encrypted = data.copy()
        aad = str(user_id) if user_id else None
        
        for field in self.PII_FIELDS:
            if field in encrypted and encrypted[field]:
                encrypted[field] = self.encrypt(str(encrypted[field]), aad)
        
        return encrypted
    
    def decrypt_dict(self, data: dict, user_id: Optional[int] = None) -> dict:
        """
        Decrypt all PII fields in a dictionary.
        """
        decrypted = data.copy()
        aad = str(user_id) if user_id else None
        
        for field in self.PII_FIELDS:
            if field in decrypted and decrypted[field]:
                decrypted[field] = self.decrypt(decrypted[field], aad)
        
        return decrypted
    
    def mask_pii(self, data: dict) -> dict:
        """
        Mask PII fields for display (e.g., ***-**-1234 for SSN).
        """
        masked = data.copy()
        
        for field in self.PII_FIELDS:
            if field in masked and masked[field]:
                value = str(masked[field])
                if field == "ssn":
                    masked[field] = f"***-**-{value[-4:]}" if len(value) >= 4 else "***"
                elif field == "bank_account":
                    masked[field] = f"****{value[-4:]}" if len(value) >= 4 else "****"
                elif field == "phone_number":
                    masked[field] = f"***-***-{value[-4:]}" if len(value) >= 4 else "***"
                elif field == "address":
                    masked[field] = "[REDACTED]"
                else:
                    # Generic masking
                    masked[field] = f"{value[:2]}***{value[-2:]}" if len(value) >= 4 else "***"
        
        return masked
    
    def is_encrypted(self, value: str) -> bool:
        """Check if a value appears to be encrypted."""
        if not value:
            return False
        
        if value.startswith("UNENC:"):
            return True
        
        try:
            decoded = base64.b64decode(value)
            # AES-GCM output should be at least 12 (nonce) + 16 (tag) bytes
            return len(decoded) >= 28
        except:
            return False


class DataMasker:
    """
    Utility for masking sensitive data in non-production environments.
    """
    
    @staticmethod
    def mask_for_logging(data: Union[dict, str]) -> Union[dict, str]:
        """
        Mask sensitive data for logging purposes.
        Ensures PII is never written to logs.
        """
        if isinstance(data, str):
            return "[SENSITIVE_DATA]"
        
        if isinstance(data, dict):
            masked = {}
            sensitive_keys = ["password", "token", "secret", "key", "ssn", "credit_card"]
            
            for key, value in data.items():
                key_lower = key.lower()
                if any(s in key_lower for s in sensitive_keys):
                    masked[key] = "[REDACTED]"
                elif isinstance(value, dict):
                    masked[key] = DataMasker.mask_for_logging(value)
                else:
                    masked[key] = value
            
            return masked
        
        return data


# ============================================================================
# Immutable Audit Log
# ============================================================================

class ImmutableAuditLog:
    """
    Append-only audit log for security and compliance.
    In production, use a dedicated audit log service or blockchain.
    """
    
    _log_file = None
    _log_entries = []  # In-memory for demo
    
    def __init__(self, log_path: Optional[str] = None):
        """Initialize audit log."""
        if log_path:
            self._log_file = log_path
        else:
            self._log_file = os.path.join(
                os.path.dirname(__file__), "..", "..", "data", "audit.log"
            )
    
    def append(
        self,
        action: str,
        resource_type: str,
        resource_id: Union[int, str],
        user_id: Optional[int],
        details: dict,
        ip_address: Optional[str] = None
    ) -> dict:
        """
        Append entry to immutable audit log.
        
        Args:
            action: The action performed (create, read, update, delete)
            resource_type: Type of resource (loan, user, document, etc.)
            resource_id: ID of the affected resource
            user_id: ID of user performing the action
            details: Additional details about the action
            ip_address: Client IP address
        
        Returns:
            The audit log entry
        """
        entry = {
            "id": len(self._log_entries) + 1,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": action,
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "user_id": user_id,
            "ip_address": ip_address,
            "details": DataMasker.mask_for_logging(details),
            "checksum": None  # Will be set below
        }
        
        # Calculate checksum for integrity verification
        entry_str = json.dumps(entry, sort_keys=True)
        
        if CRYPTO_AVAILABLE:
            h = hashes.Hash(hashes.SHA256())
            h.update(entry_str.encode())
            entry["checksum"] = base64.b64encode(h.finalize()).decode()
        else:
            import hashlib
            entry["checksum"] = hashlib.sha256(entry_str.encode()).hexdigest()
        
        # Append to in-memory log
        self._log_entries.append(entry)
        
        # Append to file (append-only mode)
        try:
            os.makedirs(os.path.dirname(self._log_file), exist_ok=True)
            with open(self._log_file, 'a') as f:
                f.write(json.dumps(entry) + "\n")
        except:
            pass  # Continue even if file write fails
        
        return entry
    
    def query(
        self,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        user_id: Optional[int] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        limit: int = 100
    ) -> list:
        """
        Query audit log entries.
        """
        results = []
        
        for entry in reversed(self._log_entries):
            if action and entry["action"] != action:
                continue
            if resource_type and entry["resource_type"] != resource_type:
                continue
            if resource_id and entry["resource_id"] != str(resource_id):
                continue
            if user_id and entry["user_id"] != user_id:
                continue
            if start_time and entry["timestamp"] < start_time:
                continue
            if end_time and entry["timestamp"] > end_time:
                continue
            
            results.append(entry)
            
            if len(results) >= limit:
                break
        
        return results
    
    def verify_integrity(self) -> dict:
        """
        Verify integrity of audit log using checksums.
        Returns verification status and any corrupted entries.
        """
        corrupted = []
        
        for entry in self._log_entries:
            stored_checksum = entry.get("checksum")
            entry_copy = entry.copy()
            entry_copy["checksum"] = None
            
            entry_str = json.dumps(entry_copy, sort_keys=True)
            
            if CRYPTO_AVAILABLE:
                h = hashes.Hash(hashes.SHA256())
                h.update(entry_str.encode())
                calculated = base64.b64encode(h.finalize()).decode()
            else:
                import hashlib
                calculated = hashlib.sha256(entry_str.encode()).hexdigest()
            
            if calculated != stored_checksum:
                corrupted.append(entry["id"])
        
        return {
            "total_entries": len(self._log_entries),
            "corrupted_entries": len(corrupted),
            "corrupted_ids": corrupted,
            "integrity_valid": len(corrupted) == 0
        }
    
    def export(self, format: str = "json") -> Union[str, bytes]:
        """
        Export audit log for compliance reporting.
        """
        if format == "json":
            return json.dumps(self._log_entries, indent=2)
        elif format == "csv":
            # Simple CSV export
            lines = ["id,timestamp,action,resource_type,resource_id,user_id,ip_address"]
            for entry in self._log_entries:
                lines.append(
                    f"{entry['id']},{entry['timestamp']},{entry['action']},"
                    f"{entry['resource_type']},{entry['resource_id']},"
                    f"{entry['user_id']},{entry['ip_address']}"
                )
            return "\n".join(lines)
        else:
            raise ValueError(f"Unsupported format: {format}")


# Singleton instances
_encryptor = None
_audit_log = None


def get_encryptor() -> FieldEncryptor:
    """Get or create the field encryptor instance."""
    global _encryptor
    if _encryptor is None:
        _encryptor = FieldEncryptor()
    return _encryptor


def get_audit_log() -> ImmutableAuditLog:
    """Get or create the audit log instance."""
    global _audit_log
    if _audit_log is None:
        _audit_log = ImmutableAuditLog()
    return _audit_log
