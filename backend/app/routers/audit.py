"""
Audit Router - Immutable Audit Log API
Provides audit trail access for compliance and security monitoring
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

from ..middleware.security import require_auth, require_role, Role
from ..services.encryption import get_audit_log, get_encryptor

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/logs")
def get_audit_logs(
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    user_id: Optional[int] = None,
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(100, ge=1, le=1000),
    current_user: Dict = Depends(require_role([Role.ADMIN, Role.AUDITOR]))
):
    """
    Query audit logs with filters.
    Only accessible by Admin and Auditor roles.
    """
    audit_log = get_audit_log()
    
    # Calculate time range
    end_time = datetime.utcnow().isoformat() + "Z"
    start_time = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
    
    entries = audit_log.query(
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        start_time=start_time,
        end_time=end_time,
        limit=limit
    )
    
    return {
        "entries": entries,
        "count": len(entries),
        "filters": {
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "user_id": user_id,
            "days": days
        }
    }


@router.get("/logs/resource/{resource_type}/{resource_id}")
def get_resource_audit_trail(
    resource_type: str,
    resource_id: str,
    limit: int = 50,
    current_user: Dict = Depends(require_role([Role.ADMIN, Role.AUDITOR, Role.ANALYST]))
):
    """
    Get complete audit trail for a specific resource.
    """
    audit_log = get_audit_log()
    
    entries = audit_log.query(
        resource_type=resource_type,
        resource_id=resource_id,
        limit=limit
    )
    
    return {
        "resource_type": resource_type,
        "resource_id": resource_id,
        "audit_trail": entries,
        "count": len(entries)
    }


@router.get("/logs/user/{user_id}")
def get_user_activity(
    user_id: int,
    days: int = 30,
    limit: int = 100,
    current_user: Dict = Depends(require_role([Role.ADMIN]))
):
    """
    Get all activity for a specific user (admin only).
    """
    audit_log = get_audit_log()
    
    start_time = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
    
    entries = audit_log.query(
        user_id=user_id,
        start_time=start_time,
        limit=limit
    )
    
    return {
        "user_id": user_id,
        "activity": entries,
        "count": len(entries),
        "days_covered": days
    }


@router.get("/logs/verify")
def verify_audit_integrity(
    current_user: Dict = Depends(require_role([Role.ADMIN]))
):
    """
    Verify integrity of audit log using checksums.
    Detects any tampering with audit records.
    """
    audit_log = get_audit_log()
    return audit_log.verify_integrity()


@router.get("/logs/export")
def export_audit_logs(
    format: str = Query("json", regex="^(json|csv)$"),
    days: int = Query(30, ge=1, le=365),
    current_user: Dict = Depends(require_role([Role.ADMIN]))
):
    """
    Export audit logs for compliance reporting.
    """
    audit_log = get_audit_log()
    
    # Filter by date range
    start_time = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
    entries = audit_log.query(start_time=start_time, limit=10000)
    
    if format == "json":
        return {
            "format": "json",
            "entries": entries,
            "export_time": datetime.utcnow().isoformat(),
            "days_covered": days
        }
    else:
        # CSV format
        lines = ["id,timestamp,action,resource_type,resource_id,user_id,ip_address"]
        for entry in entries:
            lines.append(
                f"{entry['id']},{entry['timestamp']},{entry['action']},"
                f"{entry['resource_type']},{entry['resource_id']},"
                f"{entry['user_id']},{entry['ip_address']}"
            )
        
        return {
            "format": "csv",
            "data": "\n".join(lines),
            "export_time": datetime.utcnow().isoformat()
        }


@router.get("/logs/summary")
def get_audit_summary(
    days: int = Query(7, ge=1, le=90),
    current_user: Dict = Depends(require_role([Role.ADMIN, Role.AUDITOR]))
):
    """
    Get summary statistics of audit logs.
    """
    audit_log = get_audit_log()
    
    start_time = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
    entries = audit_log.query(start_time=start_time, limit=10000)
    
    # Calculate statistics
    action_counts = {}
    resource_type_counts = {}
    user_activity = {}
    hourly_distribution = {}
    
    for entry in entries:
        # Action counts
        action = entry.get("action", "unknown")
        action_counts[action] = action_counts.get(action, 0) + 1
        
        # Resource type counts
        resource_type = entry.get("resource_type", "unknown")
        resource_type_counts[resource_type] = resource_type_counts.get(resource_type, 0) + 1
        
        # User activity
        user_id = entry.get("user_id")
        if user_id:
            user_activity[user_id] = user_activity.get(user_id, 0) + 1
        
        # Hourly distribution
        try:
            timestamp = entry.get("timestamp", "")
            hour = timestamp[11:13] if len(timestamp) > 13 else "00"
            hourly_distribution[hour] = hourly_distribution.get(hour, 0) + 1
        except:
            pass
    
    # Top active users
    top_users = sorted(user_activity.items(), key=lambda x: x[1], reverse=True)[:10]
    
    return {
        "period_days": days,
        "total_entries": len(entries),
        "action_breakdown": action_counts,
        "resource_type_breakdown": resource_type_counts,
        "hourly_distribution": hourly_distribution,
        "top_active_users": [{"user_id": u[0], "actions": u[1]} for u in top_users],
        "generated_at": datetime.utcnow().isoformat()
    }


@router.post("/logs/record")
def manually_record_event(
    action: str,
    resource_type: str,
    resource_id: str,
    details: Dict[str, Any],
    current_user: Dict = Depends(require_auth)
):
    """
    Manually record an audit event.
    Useful for custom application events.
    """
    audit_log = get_audit_log()
    
    entry = audit_log.append(
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=current_user.get("id"),
        details=details
    )
    
    return {"entry": entry, "message": "Event recorded"}


# ============================================================================
# Security Monitoring Endpoints
# ============================================================================

@router.get("/security/login-attempts")
def get_login_attempts(
    days: int = 7,
    current_user: Dict = Depends(require_role([Role.ADMIN]))
):
    """
    Get login attempt statistics for security monitoring.
    """
    audit_log = get_audit_log()
    
    start_time = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
    
    # Get login-related events
    login_success = audit_log.query(action="login_success", start_time=start_time, limit=1000)
    login_failed = audit_log.query(action="login_failed", start_time=start_time, limit=1000)
    mfa_failed = audit_log.query(action="mfa_failed", start_time=start_time, limit=1000)
    rate_limited = audit_log.query(action="login_rate_limited", start_time=start_time, limit=1000)
    
    # Group failed attempts by IP
    failed_by_ip = {}
    for entry in login_failed:
        ip = entry.get("ip_address", "unknown")
        failed_by_ip[ip] = failed_by_ip.get(ip, 0) + 1
    
    # Suspicious IPs (more than 5 failures)
    suspicious_ips = {ip: count for ip, count in failed_by_ip.items() if count >= 5}
    
    return {
        "period_days": days,
        "successful_logins": len(login_success),
        "failed_logins": len(login_failed),
        "mfa_failures": len(mfa_failed),
        "rate_limited_attempts": len(rate_limited),
        "failed_by_ip": failed_by_ip,
        "suspicious_ips": suspicious_ips,
        "generated_at": datetime.utcnow().isoformat()
    }


@router.get("/security/sensitive-operations")
def get_sensitive_operations(
    days: int = 7,
    current_user: Dict = Depends(require_role([Role.ADMIN]))
):
    """
    Get log of sensitive operations for security review.
    """
    audit_log = get_audit_log()
    
    start_time = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
    
    # Sensitive actions to track
    sensitive_actions = ["delete", "role_changed", "password_changed", "export", "decrypt"]
    
    sensitive_entries = []
    for action in sensitive_actions:
        entries = audit_log.query(action=action, start_time=start_time, limit=100)
        sensitive_entries.extend(entries)
    
    # Sort by timestamp
    sensitive_entries.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    return {
        "period_days": days,
        "sensitive_operations": sensitive_entries,
        "count": len(sensitive_entries),
        "tracked_actions": sensitive_actions
    }
