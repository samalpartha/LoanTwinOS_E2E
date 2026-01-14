"""
LoanTwin Workflow Router
Manage and execute automated workflows.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from ..services.workflows import (
    workflow_engine, Workflow, WorkflowExecution, 
    TriggerConfig, ActionConfig, TriggerType, ActionType
)

router = APIRouter(prefix="/workflows", tags=["workflows"])


class WorkflowCreateRequest(BaseModel):
    name: str
    description: str
    trigger: Dict[str, Any]
    actions: List[Dict[str, Any]]
    loan_id: Optional[int] = None


class WorkflowUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class TriggerCheckRequest(BaseModel):
    context: Dict[str, Any]


@router.get("/")
def list_workflows(loan_id: Optional[int] = None):
    """List all workflows, optionally filtered by loan."""
    workflows = workflow_engine.get_workflows(loan_id)
    return {
        "count": len(workflows),
        "workflows": [
            {
                "id": w.id,
                "name": w.name,
                "description": w.description,
                "status": w.status,
                "trigger_type": w.trigger.type.value if hasattr(w.trigger.type, 'value') else w.trigger.type,
                "action_count": len(w.actions),
                "run_count": w.run_count,
                "last_run": w.last_run,
                "loan_id": w.loan_id
            }
            for w in workflows
        ]
    }


@router.get("/{workflow_id}")
def get_workflow(workflow_id: str):
    """Get a specific workflow by ID."""
    workflow = workflow_engine.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    
    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "status": workflow.status,
        "trigger": {
            "type": workflow.trigger.type.value if hasattr(workflow.trigger.type, 'value') else workflow.trigger.type,
            "field": workflow.trigger.field,
            "operator": workflow.trigger.operator,
            "value": workflow.trigger.value,
            "event_name": workflow.trigger.event_name
        },
        "actions": [
            {
                "type": a.type.value if hasattr(a.type, 'value') else a.type,
                "params": a.params,
                "delay_seconds": a.delay_seconds,
                "require_approval": a.require_approval
            }
            for a in workflow.actions
        ],
        "loan_id": workflow.loan_id,
        "created_at": workflow.created_at,
        "run_count": workflow.run_count,
        "last_run": workflow.last_run
    }


@router.post("/")
def create_workflow(request: WorkflowCreateRequest):
    """Create a new workflow."""
    trigger = TriggerConfig(**request.trigger)
    actions = [ActionConfig(**a) for a in request.actions]
    
    workflow = Workflow(
        id="",
        name=request.name,
        description=request.description,
        trigger=trigger,
        actions=actions,
        loan_id=request.loan_id
    )
    
    created = workflow_engine.create_workflow(workflow)
    
    return {
        "status": "created",
        "workflow_id": created.id,
        "name": created.name
    }


@router.patch("/{workflow_id}")
def update_workflow(workflow_id: str, request: WorkflowUpdateRequest):
    """Update an existing workflow."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    
    updated = workflow_engine.update_workflow(workflow_id, updates)
    if not updated:
        raise HTTPException(404, "Workflow not found")
    
    return {
        "status": "updated",
        "workflow_id": workflow_id
    }


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: str):
    """Delete a workflow."""
    success = workflow_engine.delete_workflow(workflow_id)
    if not success:
        raise HTTPException(404, "Workflow not found")
    
    return {"status": "deleted", "workflow_id": workflow_id}


@router.post("/{workflow_id}/toggle")
def toggle_workflow(workflow_id: str, enabled: bool = True):
    """Enable or disable a workflow."""
    workflow = workflow_engine.toggle_workflow(workflow_id, enabled)
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    
    return {
        "status": "toggled",
        "workflow_id": workflow_id,
        "enabled": enabled,
        "current_status": workflow.status
    }


@router.post("/check-triggers/{loan_id}")
def check_triggers(loan_id: int, request: TriggerCheckRequest):
    """Check which workflows would be triggered by the given context."""
    triggered = workflow_engine.check_triggers(loan_id, request.context)
    
    return {
        "loan_id": loan_id,
        "context": request.context,
        "triggered_workflows": [
            {
                "id": w.id,
                "name": w.name,
                "description": w.description
            }
            for w in triggered
        ]
    }


@router.post("/execute/{workflow_id}/{loan_id}")
def execute_workflow(workflow_id: str, loan_id: int, context: Dict[str, Any] = None):
    """Manually execute a workflow for a loan."""
    workflow = workflow_engine.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    
    execution = workflow_engine.execute_workflow(workflow, loan_id, context or {})
    
    return {
        "execution_id": execution.id,
        "workflow_id": workflow_id,
        "workflow_name": execution.workflow_name,
        "status": execution.status,
        "results": execution.results,
        "error": execution.error
    }


@router.get("/executions/")
def list_executions(loan_id: Optional[int] = None, workflow_id: Optional[str] = None, limit: int = 50):
    """List workflow executions."""
    executions = workflow_engine.get_executions(loan_id, workflow_id)[:limit]
    
    return {
        "count": len(executions),
        "executions": [
            {
                "id": e.id,
                "workflow_id": e.workflow_id,
                "workflow_name": e.workflow_name,
                "loan_id": e.loan_id,
                "status": e.status,
                "started_at": e.started_at,
                "completed_at": e.completed_at,
                "results_count": len(e.results),
                "error": e.error
            }
            for e in executions
        ]
    }


@router.get("/executions/{execution_id}")
def get_execution(execution_id: str):
    """Get details of a specific execution."""
    from ..services.workflows import _executions
    
    execution = _executions.get(execution_id)
    if not execution:
        raise HTTPException(404, "Execution not found")
    
    return {
        "id": execution.id,
        "workflow_id": execution.workflow_id,
        "workflow_name": execution.workflow_name,
        "loan_id": execution.loan_id,
        "status": execution.status,
        "started_at": execution.started_at,
        "completed_at": execution.completed_at,
        "trigger_data": execution.trigger_data,
        "results": execution.results,
        "error": execution.error
    }


@router.get("/templates")
def get_workflow_templates():
    """Get available workflow templates for quick setup."""
    return {
        "templates": [
            {
                "id": "trade_ready",
                "name": "Trade Readiness Notification",
                "description": "Notify buyers when trade readiness score reaches threshold",
                "trigger_type": "score_threshold",
                "category": "trading"
            },
            {
                "id": "covenant_breach",
                "name": "Covenant Breach Alert",
                "description": "Draft waiver and escalate on covenant breach",
                "trigger_type": "condition_change",
                "category": "compliance"
            },
            {
                "id": "esg_deadline",
                "name": "ESG Verification Reminder",
                "description": "Schedule verifier before ESG deadline",
                "trigger_type": "time_based",
                "category": "esg"
            },
            {
                "id": "rating_change",
                "name": "Rating Downgrade Response",
                "description": "Recalculate margins on rating change",
                "trigger_type": "event",
                "category": "risk"
            },
            {
                "id": "obligation_overdue",
                "name": "Overdue Obligation Escalation",
                "description": "Send reminders and escalate overdue items",
                "trigger_type": "condition_change",
                "category": "compliance"
            }
        ],
        "trigger_types": [t.value for t in TriggerType],
        "action_types": [a.value for a in ActionType]
    }
