"""
LoanTwin Workflow Engine
========================
Event-driven automation for loan lifecycle management.
Triggers automated actions based on conditions like score thresholds, time-based events, etc.
"""
from __future__ import annotations
import json
import uuid
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Callable
from enum import Enum
from pydantic import BaseModel
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Loan, Obligation, TradeCheck, AuditLog


class TriggerType(str, Enum):
    SCORE_THRESHOLD = "score_threshold"
    TIME_BASED = "time_based"
    EVENT = "event"
    CONDITION_CHANGE = "condition_change"
    MANUAL = "manual"


class ActionType(str, Enum):
    NOTIFY_BUYERS = "notify_buyers"
    DRAFT_DOCUMENT = "draft_document"
    SEND_REMINDER = "send_reminder"
    UPDATE_STATUS = "update_status"
    ESCALATE = "escalate"
    RECALCULATE = "recalculate"
    WEBHOOK = "webhook"
    AGENT_TASK = "agent_task"


class WorkflowStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"


class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class TriggerConfig(BaseModel):
    type: TriggerType
    field: Optional[str] = None
    operator: Optional[str] = None  # >=, <=, ==, >, <, contains
    value: Optional[Any] = None
    schedule: Optional[str] = None  # cron or interval
    event_name: Optional[str] = None


class ActionConfig(BaseModel):
    type: ActionType
    params: Dict[str, Any] = {}
    delay_seconds: int = 0
    require_approval: bool = False


class Workflow(BaseModel):
    id: str
    name: str
    description: str
    trigger: TriggerConfig
    actions: List[ActionConfig]
    status: WorkflowStatus = WorkflowStatus.ACTIVE
    loan_id: Optional[int] = None  # None = applies to all loans
    created_at: str = ""
    last_run: Optional[str] = None
    run_count: int = 0
    
    class Config:
        use_enum_values = True


class WorkflowExecution(BaseModel):
    id: str
    workflow_id: str
    workflow_name: str
    loan_id: int
    status: ExecutionStatus
    started_at: str
    completed_at: Optional[str] = None
    trigger_data: Dict[str, Any] = {}
    results: List[Dict[str, Any]] = []
    error: Optional[str] = None


# In-memory stores (in production, use database)
_workflows: Dict[str, Workflow] = {}
_executions: Dict[str, WorkflowExecution] = {}


def _init_default_workflows():
    """Initialize default system workflows."""
    defaults = [
        Workflow(
            id="wf_trade_ready",
            name="Trade Readiness Notification",
            description="Notify pre-cleared buyers when trade readiness score reaches 100%",
            trigger=TriggerConfig(
                type=TriggerType.SCORE_THRESHOLD,
                field="trade_readiness_score",
                operator=">=",
                value=100
            ),
            actions=[
                ActionConfig(type=ActionType.NOTIFY_BUYERS, params={"buyer_type": "pre_cleared"}),
                ActionConfig(type=ActionType.UPDATE_STATUS, params={"status": "ready_to_trade"})
            ],
            created_at=datetime.now().isoformat()
        ),
        Workflow(
            id="wf_covenant_breach",
            name="Covenant Breach Alert",
            description="Draft waiver request and alert agent when covenant is breached",
            trigger=TriggerConfig(
                type=TriggerType.CONDITION_CHANGE,
                event_name="covenant_breach"
            ),
            actions=[
                ActionConfig(type=ActionType.DRAFT_DOCUMENT, params={"document_type": "waiver_request"}),
                ActionConfig(type=ActionType.ESCALATE, params={"level": "agent_bank"})
            ],
            created_at=datetime.now().isoformat()
        ),
        Workflow(
            id="wf_esg_deadline",
            name="ESG Verification Reminder",
            description="Schedule ESG verifier 30 days before deadline",
            trigger=TriggerConfig(
                type=TriggerType.TIME_BASED,
                field="esg_verification_date",
                operator="days_before",
                value=30
            ),
            actions=[
                ActionConfig(type=ActionType.AGENT_TASK, params={"task": "schedule_esg_verifier"}),
                ActionConfig(type=ActionType.SEND_REMINDER, params={"recipient": "borrower"})
            ],
            created_at=datetime.now().isoformat()
        ),
        Workflow(
            id="wf_rating_change",
            name="Rating Downgrade Response",
            description="Recalculate margins and notify when rating changes",
            trigger=TriggerConfig(
                type=TriggerType.EVENT,
                event_name="rating_change"
            ),
            actions=[
                ActionConfig(type=ActionType.RECALCULATE, params={"fields": ["margin", "pricing_grid"]}),
                ActionConfig(type=ActionType.NOTIFY_BUYERS, params={"message": "Rating change detected"})
            ],
            created_at=datetime.now().isoformat()
        ),
        Workflow(
            id="wf_obligation_overdue",
            name="Overdue Obligation Escalation",
            description="Send reminder and escalate when obligation becomes overdue",
            trigger=TriggerConfig(
                type=TriggerType.CONDITION_CHANGE,
                event_name="obligation_overdue"
            ),
            actions=[
                ActionConfig(type=ActionType.SEND_REMINDER, params={"recipient": "borrower", "urgency": "high"}),
                ActionConfig(type=ActionType.ESCALATE, params={"level": "facility_agent"}, delay_seconds=86400)  # 24 hours
            ],
            created_at=datetime.now().isoformat()
        ),
        Workflow(
            id="wf_market_alert",
            name="Market Volatility Response",
            description="Run stress test when market volatility exceeds threshold",
            trigger=TriggerConfig(
                type=TriggerType.SCORE_THRESHOLD,
                field="volatility_index",
                operator=">",
                value=30
            ),
            actions=[
                ActionConfig(type=ActionType.AGENT_TASK, params={"task": "run_stress_test", "scenario": "market_shock"})
            ],
            created_at=datetime.now().isoformat()
        )
    ]
    
    for wf in defaults:
        _workflows[wf.id] = wf


# Initialize on module load
_init_default_workflows()


class WorkflowEngine:
    """Engine for managing and executing workflows."""
    
    def __init__(self):
        self.action_handlers: Dict[ActionType, Callable] = {
            ActionType.NOTIFY_BUYERS: self._handle_notify_buyers,
            ActionType.DRAFT_DOCUMENT: self._handle_draft_document,
            ActionType.SEND_REMINDER: self._handle_send_reminder,
            ActionType.UPDATE_STATUS: self._handle_update_status,
            ActionType.ESCALATE: self._handle_escalate,
            ActionType.RECALCULATE: self._handle_recalculate,
            ActionType.WEBHOOK: self._handle_webhook,
            ActionType.AGENT_TASK: self._handle_agent_task,
        }
    
    def get_workflows(self, loan_id: Optional[int] = None) -> List[Workflow]:
        """Get all workflows, optionally filtered by loan."""
        workflows = list(_workflows.values())
        if loan_id:
            workflows = [w for w in workflows if w.loan_id is None or w.loan_id == loan_id]
        return workflows
    
    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Get a specific workflow."""
        return _workflows.get(workflow_id)
    
    def create_workflow(self, workflow: Workflow) -> Workflow:
        """Create a new workflow."""
        workflow.id = workflow.id or str(uuid.uuid4())
        workflow.created_at = datetime.now().isoformat()
        _workflows[workflow.id] = workflow
        return workflow
    
    def update_workflow(self, workflow_id: str, updates: Dict[str, Any]) -> Optional[Workflow]:
        """Update an existing workflow."""
        workflow = _workflows.get(workflow_id)
        if not workflow:
            return None
        
        for key, value in updates.items():
            if hasattr(workflow, key):
                setattr(workflow, key, value)
        
        return workflow
    
    def delete_workflow(self, workflow_id: str) -> bool:
        """Delete a workflow."""
        if workflow_id in _workflows:
            del _workflows[workflow_id]
            return True
        return False
    
    def toggle_workflow(self, workflow_id: str, enabled: bool) -> Optional[Workflow]:
        """Enable or disable a workflow."""
        workflow = _workflows.get(workflow_id)
        if workflow:
            workflow.status = WorkflowStatus.ACTIVE if enabled else WorkflowStatus.DISABLED
        return workflow
    
    def check_triggers(self, loan_id: int, context: Dict[str, Any]) -> List[Workflow]:
        """Check which workflows should be triggered based on current context."""
        triggered = []
        
        for workflow in self.get_workflows(loan_id):
            if workflow.status != WorkflowStatus.ACTIVE:
                continue
            
            if self._evaluate_trigger(workflow.trigger, context):
                triggered.append(workflow)
        
        return triggered
    
    def _evaluate_trigger(self, trigger: TriggerConfig, context: Dict[str, Any]) -> bool:
        """Evaluate if a trigger condition is met."""
        if trigger.type == TriggerType.SCORE_THRESHOLD:
            current_value = context.get(trigger.field, 0)
            target_value = trigger.value
            
            if trigger.operator == ">=":
                return current_value >= target_value
            elif trigger.operator == "<=":
                return current_value <= target_value
            elif trigger.operator == ">":
                return current_value > target_value
            elif trigger.operator == "<":
                return current_value < target_value
            elif trigger.operator == "==":
                return current_value == target_value
        
        elif trigger.type == TriggerType.EVENT:
            return context.get("event") == trigger.event_name
        
        elif trigger.type == TriggerType.CONDITION_CHANGE:
            return context.get("condition_changed") == trigger.event_name
        
        elif trigger.type == TriggerType.TIME_BASED:
            target_date_str = context.get(trigger.field)
            if target_date_str:
                try:
                    target_date = datetime.fromisoformat(target_date_str).date()
                    today = date.today()
                    days_until = (target_date - today).days
                    
                    if trigger.operator == "days_before":
                        return days_until == trigger.value
                    elif trigger.operator == "days_after":
                        return days_until == -trigger.value
                except:
                    pass
        
        return False
    
    def execute_workflow(self, workflow: Workflow, loan_id: int, context: Dict[str, Any]) -> WorkflowExecution:
        """Execute a workflow for a specific loan."""
        execution = WorkflowExecution(
            id=str(uuid.uuid4()),
            workflow_id=workflow.id,
            workflow_name=workflow.name,
            loan_id=loan_id,
            status=ExecutionStatus.RUNNING,
            started_at=datetime.now().isoformat(),
            trigger_data=context
        )
        _executions[execution.id] = execution
        
        try:
            for action in workflow.actions:
                # Skip if requires approval (queue for later)
                if action.require_approval:
                    execution.results.append({
                        "action": action.type.value,
                        "status": "queued_for_approval",
                        "message": "Action requires human approval"
                    })
                    continue
                
                # Execute action
                handler = self.action_handlers.get(action.type)
                if handler:
                    result = handler(loan_id, action.params, context)
                    execution.results.append({
                        "action": action.type.value,
                        "status": "completed",
                        "result": result
                    })
                else:
                    execution.results.append({
                        "action": action.type.value,
                        "status": "skipped",
                        "message": "No handler found"
                    })
            
            execution.status = ExecutionStatus.COMPLETED
            execution.completed_at = datetime.now().isoformat()
            
            # Update workflow stats
            workflow.last_run = datetime.now().isoformat()
            workflow.run_count += 1
            
            # Log execution
            self._log_execution(loan_id, workflow, execution)
            
        except Exception as e:
            execution.status = ExecutionStatus.FAILED
            execution.error = str(e)
            execution.completed_at = datetime.now().isoformat()
        
        return execution
    
    def get_executions(self, loan_id: Optional[int] = None, workflow_id: Optional[str] = None) -> List[WorkflowExecution]:
        """Get workflow executions, optionally filtered."""
        executions = list(_executions.values())
        
        if loan_id:
            executions = [e for e in executions if e.loan_id == loan_id]
        if workflow_id:
            executions = [e for e in executions if e.workflow_id == workflow_id]
        
        return sorted(executions, key=lambda e: e.started_at, reverse=True)
    
    # Action Handlers
    
    def _handle_notify_buyers(self, loan_id: int, params: Dict, context: Dict) -> Dict:
        """Notify pre-cleared or interested buyers."""
        buyer_type = params.get("buyer_type", "all")
        message = params.get("message", "Deal update available")
        
        # In production, this would send emails/notifications
        return {
            "notification_sent": True,
            "buyer_type": buyer_type,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
    
    def _handle_draft_document(self, loan_id: int, params: Dict, context: Dict) -> Dict:
        """Trigger document drafting via agent."""
        from .agents import orchestrator
        
        doc_type = params.get("document_type", "generic")
        
        # Trigger agent workflow
        recommendations = orchestrator.analyze_loan(loan_id)
        
        return {
            "document_type": doc_type,
            "agent_triggered": True,
            "recommendations_generated": len(recommendations)
        }
    
    def _handle_send_reminder(self, loan_id: int, params: Dict, context: Dict) -> Dict:
        """Send reminder notification."""
        recipient = params.get("recipient", "borrower")
        urgency = params.get("urgency", "normal")
        
        return {
            "reminder_sent": True,
            "recipient": recipient,
            "urgency": urgency,
            "timestamp": datetime.now().isoformat()
        }
    
    def _handle_update_status(self, loan_id: int, params: Dict, context: Dict) -> Dict:
        """Update loan or obligation status."""
        new_status = params.get("status", "updated")
        
        return {
            "status_updated": True,
            "new_status": new_status
        }
    
    def _handle_escalate(self, loan_id: int, params: Dict, context: Dict) -> Dict:
        """Escalate to appropriate party."""
        level = params.get("level", "agent_bank")
        
        return {
            "escalated": True,
            "escalation_level": level,
            "timestamp": datetime.now().isoformat()
        }
    
    def _handle_recalculate(self, loan_id: int, params: Dict, context: Dict) -> Dict:
        """Recalculate specified fields."""
        fields = params.get("fields", [])
        
        return {
            "recalculated": True,
            "fields": fields
        }
    
    def _handle_webhook(self, loan_id: int, params: Dict, context: Dict) -> Dict:
        """Call external webhook."""
        url = params.get("url", "")
        
        # In production, this would make HTTP request
        return {
            "webhook_triggered": True,
            "url": url,
            "status": "simulated"
        }
    
    def _handle_agent_task(self, loan_id: int, params: Dict, context: Dict) -> Dict:
        """Queue a task for the AI agent."""
        task = params.get("task", "analyze")
        
        return {
            "agent_task_queued": True,
            "task": task,
            "loan_id": loan_id
        }
    
    def _log_execution(self, loan_id: int, workflow: Workflow, execution: WorkflowExecution):
        """Log workflow execution to audit trail."""
        with Session(engine) as session:
            log = AuditLog(
                loan_id=loan_id,
                user="Workflow Engine",
                action=f"WORKFLOW_EXECUTED: {workflow.name}",
                field_changed="workflow",
                old_value="",
                new_value=execution.status.value,
                timestamp=datetime.now()
            )
            session.add(log)
            session.commit()


# Singleton instance
workflow_engine = WorkflowEngine()
