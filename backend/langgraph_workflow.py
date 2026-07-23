import json
from typing import TypedDict, Dict, Any, List
from langgraph.graph import StateGraph, END
from extraction_agent import extract_complaint_with_llm

class ComplaintState(TypedDict):
    raw_document_text: str
    api_key: str
    extraction_stage: str
    progress_percentage: int
    extracted_data: Dict[str, Any]
    error: str

def parse_input_node(state: ComplaintState) -> ComplaintState:
    raw_text = state.get("raw_document_text", "")
    if not raw_text or len(raw_text.strip()) == 0:
        return {**state, "error": "Empty text provided", "progress_percentage": 0}
    return {**state, "extraction_stage": "Document Parsed", "progress_percentage": 30}

def llm_extraction_node(state: ComplaintState) -> ComplaintState:
    raw_text = state.get("raw_document_text", "")
    api_key = state.get("api_key", "")
    extracted = extract_complaint_with_llm(raw_text, api_key=api_key)
    return {
        **state,
        "extracted_data": extracted,
        "extraction_stage": "Entities Extracted & Validated",
        "progress_percentage": 80
    }

def qms_risk_assessment_node(state: ComplaintState) -> ComplaintState:
    extracted = state.get("extracted_data", {})
    # Final cGMP QA checks
    if not extracted.get("initial_severity"):
        extracted["initial_severity"] = "Major"
    if not extracted.get("priority"):
        extracted["priority"] = "High"

    return {
        **state,
        "extracted_data": extracted,
        "extraction_stage": "QMS Triage Completed",
        "progress_percentage": 100
    }

def build_complaint_graph():
    workflow = StateGraph(ComplaintState)

    workflow.add_node("parse_input", parse_input_node)
    workflow.add_node("llm_extraction", llm_extraction_node)
    workflow.add_node("qms_risk_assessment", qms_risk_assessment_node)

    workflow.set_entry_point("parse_input")
    workflow.add_edge("parse_input", "llm_extraction")
    workflow.add_edge("llm_extraction", "qms_risk_assessment")
    workflow.add_edge("qms_risk_assessment", END)

    return workflow.compile()

complaint_app = build_complaint_graph()
