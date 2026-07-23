import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Database,
  Send,
  Sparkles,
  Bot,
  ShieldCheck,
  Building2,
  Package,
  Calendar,
  Zap,
  RotateCcw,
  Save,
  HelpCircle,
  FileUp,
  Search
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('intake'); // 'intake' | 'records'
  const [apiKey, setApiKey] = useState('');
  
  // Left Form State (Read-Only / Populated strictly by AI)
  const initialFormState = {
    complaint_source: '',
    customer_name: '',
    product_name: '',
    product_strength_grade: '',
    batch_lot_number: '',
    manufacturing_date: '',
    expiry_date: '',
    quantity_affected: '',
    complaint_type: '',
    complaint_date: '',
    detailed_description: '',
    initial_severity: '',
    priority: '',
    status: 'Pending Triage'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Right Panel AI Assistant States
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');

  // Chat & AI Tools
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'assistant',
      text: '👋 Welcome to AI Complaint Intake! Upload a complaint document or paste unstructured text above. I will automatically parse the details, populate the form on the left, and generate a cGMP risk assessment for you.'
    }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Log Records state
  const [complaintsLog, setComplaintsLog] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchComplaints = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/complaints`);
      setComplaintsLog(res.data);
    } catch (err) {
      console.error('Failed to fetch complaint logs:', err);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  // TOOL 1: Log Complaint Tool (From text prompt)
  const handleLogComplaintFromText = async () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    setProgress(30);
    setProcessingStage('Executing Log Complaint Tool: Analyzing text & calculating risk assessment...');
    setSaveSuccess(false);

    try {
      const res = await axios.post(`${API_BASE}/api/extract-text`, {
        text: rawText,
        api_key: apiKey
      });
      setProgress(100);
      setProcessingStage('Complete');
      setFormData(res.data.extracted);
      setHasExtracted(true);

      setChatMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: `✨ **Log Complaint Tool Executed Successfully!**\n\n- **Product**: ${res.data.extracted.product_name || 'N/A'}\n- **Batch/Lot**: ${res.data.extracted.batch_lot_number || 'N/A'}\n- **Severity Risk**: ${res.data.extracted.initial_severity || 'Minor'}\n- **Priority**: ${res.data.extracted.priority || 'Medium'}\n\nThe form on the left has been populated. You can ask me questions or request natural language edits (e.g., *"Change batch number to BATCH-99"* or *"Update quantity to 200 kg"*).`
        }
      ]);
    } catch (err) {
      alert('Extraction failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // TOOL 2: Document Extraction Tool (From PDF / DOCX / TXT)
  const handleDocumentExtraction = async (file) => {
    const fileToUpload = file || selectedFile;
    if (!fileToUpload) return;

    setIsProcessing(true);
    setProgress(20);
    setProcessingStage(`Executing Document Extraction Tool on ${fileToUpload.name}...`);
    setSaveSuccess(false);

    const data = new FormData();
    data.append('file', fileToUpload);
    if (apiKey) data.append('api_key', apiKey);

    try {
      const res = await axios.post(`${API_BASE}/api/extract-file`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setProgress(100);
      setProcessingStage('Complete');
      setFormData(res.data.extracted);
      setHasExtracted(true);

      setChatMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: `📄 **Document Extraction Tool Executed!**\nExtracted details from **${fileToUpload.name}** and generated cGMP risk assessment.\n\nForm updated on the left panel.`
        }
      ]);
    } catch (err) {
      alert('Document parsing failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // TOOL 3: Edit Complaint Tool & QA Assistant Chat
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userText = chatInput;
    setChatInput('');

    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsProcessing(true);

    const isEditIntent = /change|update|set|correct|modify|edit|switch|increase|decrease|fix/i.test(userText);

    try {
      if (hasExtracted && isEditIntent) {
        // Execute Edit Complaint Tool
        const res = await axios.post(`${API_BASE}/api/edit-complaint`, {
          existing_data: formData,
          edit_instruction: userText,
          api_key: apiKey
        });

        setFormData(res.data.updated);
        setChatMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: `✏️ **Edit Complaint Tool Executed!**\nApplied your correction: *"${userText}"*.\n\nForm fields and risk assessment have been updated while preserving existing parameters.`
          }
        ]);
      } else {
        // Standard QA Copilot Q&A
        const res = await axios.post(`${API_BASE}/api/chat`, {
          complaint_context: hasExtracted ? formData : { raw_input: userText },
          user_question: userText,
          api_key: apiKey
        });

        setChatMessages(prev => [
          ...prev,
          { sender: 'assistant', text: res.data.reply }
        ]);
      }
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'assistant', text: 'Error contacting AI assistant.' }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save complaint to database
  const handleSaveComplaint = async () => {
    if (!hasExtracted) return;
    try {
      await axios.post(`${API_BASE}/api/complaints`, formData);
      setSaveSuccess(true);
      fetchComplaints();
    } catch (err) {
      alert('Error saving complaint: ' + err.message);
    }
  };

  // Sample Loaders
  const loadSample = (type) => {
    if (type === 'oos') {
      setRawText(`URGENT NOTICE OF OOS NON-CONFORMANCE:
From: Dr. Aris Thorne, Lead QA Specialist at BioPharma Global Ltd.
Date: 2026-07-22
Product: Paracetamol Active Pharmaceutical Ingredient (API) Microfine
Batch / Lot Number: BATCH-2026-PAR-904
Manufacturing Date: 2026-02-10 | Expiry Date: 2028-02-09
Quantity Affected: 150 kg (3 Drums)

Defect Details:
During routine incoming QC testing at our Dublin formulation facility, Lot BATCH-2026-PAR-904 was found Out-Of-Specification (OOS) for Chemical Assay. HPLC assay showed 96.2% purity (cGMP Spec: 99.0% - 101.0%). Unknown impurity peak observed at 0.45% level. Critical safety risk.`);
    } else {
      setRawText(`CUSTOMER COMPLAINT LOG
Customer Name: St. Jude Clinical Supply Network
Product Name: Metformin HCl 500mg Extended Release Tablets (FDF)
Batch Number: LOT-MET-88392
Mfg Date: 2025-11-20 | Expiry Date: 2027-11-19
Quantity: 4,000 Blister Strip Units
Complaint Date: 2026-07-21

Description:
Nurse reported distinct dark brown spots and discoloration on blister packs. Physical seal intact but abnormal oxidative spots observed.`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="app-header">
        <div className="brand-badge">
          <ShieldCheck className="w-7 h-7 text-blue-500" />
          <span>PharmaQMS <span className="text-purple-400 font-normal text-sm">AI Intake & Triage</span></span>
        </div>

        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'intake' ? 'active' : ''}`}
            onClick={() => setActiveTab('intake')}
          >
            <Sparkles className="w-4 h-4" />
            AI Intake & Triage
          </button>
          <button
            className={`nav-tab ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => { setActiveTab('records'); fetchComplaints(); }}
          >
            <Database className="w-4 h-4" />
            cGMP Complaint Log ({complaintsLog.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="password"
            placeholder="Optional Groq API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input-field text-xs py-1.5 w-44"
          />
        </div>
      </header>

      {/* Main Two-Panel Workspace */}
      <main className="main-content flex-1 py-6 px-4 max-w-[1600px] mx-auto w-full">
        {activeTab === 'intake' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT PANEL: Log Customer Complaint Form (Read-Only, Populated strictly by AI) */}
            <div className="lg:col-span-7 card flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                  <div>
                    <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                      Log Customer Complaint
                    </h1>
                    <p className="text-xs text-slate-400">API & FDF Quality Assurance Module</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">
                    {formData.status || 'Pending Triage'}
                  </span>
                </div>

                {/* Section 1: Origin & Customer Details */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">1. Origin & Customer Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Complaint Source</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.complaint_source || ''}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Customer Name</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.customer_name || ''}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Product & Batch Identification */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">2. Product & Batch Identification</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Product Name</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed font-medium text-purple-300"
                        placeholder="Awaiting AI extraction..."
                        value={formData.product_name || ''}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Product Strength / Grade</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.product_strength_grade || ''}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Batch / Lot Number</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-blue-400 font-mono font-bold cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.batch_lot_number || ''}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Manufacturing Date</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.manufacturing_date || ''}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Expiry Date</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.expiry_date || ''}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Quantity Affected</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.quantity_affected || ''}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Complaint Details */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">3. Complaint Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Complaint Type</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.complaint_type || ''}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Complaint Date</label>
                      <input
                        type="text"
                        readOnly
                        className="input-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                        placeholder="Awaiting AI extraction..."
                        value={formData.complaint_date || ''}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Detailed Complaint Description</label>
                    <textarea
                      rows={3}
                      readOnly
                      className="textarea-field text-xs bg-slate-900/90 text-slate-300 cursor-not-allowed"
                      placeholder="Awaiting AI extraction..."
                      value={formData.detailed_description || ''}
                    />
                  </div>
                </div>

                {/* Section 4: Initial Risk Assessment & Priority */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">4. AI Co-Pilot Risk Assessment & Recommended Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Initial Severity Classification</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge ${
                          formData.initial_severity === 'Critical' ? 'badge-critical' :
                          formData.initial_severity === 'Major' ? 'badge-major' :
                          formData.initial_severity === 'Minor' ? 'badge-minor' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {formData.initial_severity || 'Awaiting AI extraction...'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Priority Level</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/50">
                          {formData.priority || 'Awaiting AI extraction...'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-amber-400 block mb-1 uppercase tracking-wider">Severity Reasoning</label>
                      <p className="text-xs text-slate-300 leading-relaxed italic">
                        {formData.severity_reasoning || 'AI reasoning will be calculated automatically upon extraction or update.'}
                      </p>
                    </div>
                    <div className="border-t border-slate-800/80 pt-2.5">
                      <label className="text-[11px] font-bold text-teal-400 block mb-1 uppercase tracking-wider">Recommended Next Actions</label>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-mono">
                        {formData.recommended_actions || '1. Awaiting complaint extraction...\n2. Next cGMP actions will appear here.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Action Controls */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button
                  onClick={() => { setFormData(initialFormState); setHasExtracted(false); setSaveSuccess(false); }}
                  className="btn btn-secondary text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Form
                </button>

                <button
                  onClick={handleSaveComplaint}
                  disabled={!hasExtracted}
                  className={`btn text-xs ${saveSuccess ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'btn-primary'}`}
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Logged to Database
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Complaint
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: AI Complaint Intake Assistant & Copilot */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Header Card with Tools */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <div className="card-title mb-0">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    AI Complaint Intake Assistant
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                    BETA
                  </span>
                </div>

                {/* Drag & Drop / File Upload Tool */}
                <div className="border-2 border-dashed border-slate-700 rounded-xl p-5 text-center bg-slate-900/60 hover:border-blue-500/50 transition-colors mb-4">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.eml"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setSelectedFile(file);
                      if (file) handleDocumentExtraction(file);
                    }}
                    className="hidden"
                    id="file-upload-tool"
                  />
                  <label htmlFor="file-upload-tool" className="cursor-pointer flex flex-col items-center gap-1.5">
                    <FileUp className="w-8 h-8 text-blue-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      {selectedFile ? selectedFile.name : 'Drag & drop complaint document here or click to browse'}
                    </span>
                    <span className="text-[10px] text-slate-500">Supported formats: PDF, DOCX, TXT, EML (Max: 10MB)</span>
                  </label>
                </div>

                <div className="relative text-center mb-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                  <span className="relative px-3 bg-[#151c2c] text-[11px] text-slate-500 font-semibold uppercase">OR</span>
                </div>

                {/* Text Prompt Tool */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => loadSample('oos')} className="btn btn-secondary text-[11px] py-1 px-2.5">
                      Sample OOS
                    </button>
                    <button onClick={() => loadSample('discoloration')} className="btn btn-secondary text-[11px] py-1 px-2.5">
                      Sample Discoloration
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    className="textarea-field text-xs"
                    placeholder="Paste complaint text or email snippet here..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />

                  <button
                    onClick={handleLogComplaintFromText}
                    disabled={isProcessing || !rawText.trim()}
                    className="btn btn-primary w-full text-xs py-2"
                  >
                    {isProcessing ? (
                      <>
                        <Zap className="w-4 h-4 animate-spin" />
                        Extracting & Calculating Risk...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Execute Log Complaint Tool
                      </>
                    )}
                  </button>
                </div>

                {/* Progress Bar */}
                {isProcessing && (
                  <div className="mt-4 p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg">
                    <div className="flex justify-between text-[11px] text-blue-300 mb-1">
                      <span>{processingStage}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat & Natural Language Edit Assistant Window */}
              <div className="card flex-1 flex flex-col min-h-[380px]">
                <div className="card-title mb-2 text-xs">
                  <Bot className="w-4 h-4 text-teal-400" />
                  AI Assistant & Natural Language Editor
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-900/90 rounded-lg border border-slate-800 mb-3 max-h-[320px]">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.sender === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div
                        className={`p-3 rounded-xl max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="text-[11px] text-slate-500 italic flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5 animate-spin" />
                      AI Assistant processing...
                    </div>
                  )}
                </div>

                {/* Chat / Edit Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask a question or edit form (e.g. 'Set batch number to BATCH-100')..."
                    className="input-field text-xs"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button onClick={handleSendMessage} disabled={isProcessing} className="btn btn-primary py-2 px-3">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 text-center mt-1">
                  AI responses may contain errors. Please verify information.
                </span>
              </div>

            </div>
          </div>
        )}

        {/* RECORDS LOG TAB */}
        {activeTab === 'records' && (
          <div className="card">
            <div className="flex flex-col md:flex-row justify-between items-md-center gap-4 mb-6">
              <div>
                <div className="card-title mb-1">
                  <Database className="w-5 h-5 text-blue-400" />
                  cGMP Audit Log Database
                </div>
                <p className="text-xs text-slate-400">Recorded complaints history with severe risk classifications for Quality Management inspection.</p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by Product, Batch, Customer..."
                  className="input-field text-xs pl-9 py-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="p-3">ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Batch / Lot</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {complaintsLog.filter(c =>
                    (c.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (c.batch_lot_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-3 text-slate-500 font-mono">#{c.id}</td>
                      <td className="p-3 font-medium text-slate-200">{c.customer_name || 'N/A'}</td>
                      <td className="p-3 text-slate-300">{c.product_name || 'N/A'}</td>
                      <td className="p-3 font-mono text-blue-400">{c.batch_lot_number || 'N/A'}</td>
                      <td className="p-3 text-slate-400">{c.complaint_type || 'N/A'}</td>
                      <td className="p-3">
                        <span className={`badge ${
                          c.initial_severity === 'Critical' ? 'badge-critical' :
                          c.initial_severity === 'Major' ? 'badge-major' : 'badge-minor'
                        }`}>
                          {c.initial_severity || 'Minor'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">
                          {c.status || 'Pending Triage'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{c.complaint_date || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
