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
  Layers,
  Search,
  ShieldCheck,
  Building2,
  Package,
  Calendar,
  Zap,
  Activity,
  FileSpreadsheet
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('intake'); // 'intake' | 'records' | 'analytics'
  const [apiKey, setApiKey] = useState('');
  
  // Extraction states
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStage, setExtractionStage] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Chatbot states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  // Records states
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Pre-load sample complaints
  const loadSample = (sampleType) => {
    if (sampleType === 'oos') {
      setRawText(`URGENT NOTICE OF OOS NON-CONFORMANCE:
From: Dr. Aris Thorne, Lead QA Specialist at BioPharma Global Ltd.
Date: 2026-07-22
Product: Paracetamol Active Pharmaceutical Ingredient (API) Microfine
Batch / Lot Number: BATCH-2026-PAR-904
Manufacturing Date: 2026-02-10 | Expiry Date: 2028-02-09
Quantity Affected: 150 kg (3 Drums)

Defect Details:
During routine incoming QC testing at our Dublin formulation facility, Lot BATCH-2026-PAR-904 was found Out-Of-Specification (OOS) for Chemical Assay and Related Substances. HPLC assay showed 96.2% purity (cGMP Specification: 99.0% - 101.0%). Unknown impurity peak observed at RRT 1.45 at 0.45% level.
Initial Severity: Critical risk due to potential degradation products.`);
    } else if (sampleType === 'discoloration') {
      setRawText(`CUSTOMER COMPLAINT LOG
Source: Hospital Pharmacy Procurement
Customer Name: St. Jude Clinical Supply Network
Product Name: Metformin HCl 500mg Extended Release Tablets (FDF)
Batch Number: LOT-MET-88392
Mfg Date: 2025-11-20 | Expiry Date: 2027-11-19
Quantity: 4,000 Blister Strip Units
Complaint Date: 2026-07-21

Description:
Nurse reported distinct dark brown spots and discoloration on blister packs upon opening carton box. Physical integrity of blister seal appears intact, but tablet matrix displays abnormal oxidative spots. Requesting immediate sample retention inspection and CAPA root cause investigation.`);
    }
  };

  const handleTextExtract = async () => {
    if (!rawText.trim()) return;
    setIsExtracting(true);
    setExtractionProgress(25);
    setExtractionStage('Parsing Complaint Document & Running cGMP Safety Checks...');
    setSaveSuccess(false);

    try {
      const res = await axios.post(`${API_BASE}/api/extract-text`, {
        text: rawText,
        api_key: apiKey
      });
      setExtractionProgress(100);
      setExtractionStage('Extraction Complete');
      setExtractedData(res.data.extracted);
      setChatMessages([
        {
          sender: 'assistant',
          text: `Hello! I have extracted all cGMP metadata from this complaint. Ask me anything about Batch **${res.data.extracted.batch_lot_number || 'N/A'}**, risk severity, or recommended CAPA steps!`
        }
      ]);
    } catch (err) {
      alert('Error during extraction: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileExtract = async () => {
    if (!selectedFile) return;
    setIsExtracting(true);
    setExtractionProgress(20);
    setExtractionStage(`Reading ${selectedFile.name}...`);
    setSaveSuccess(false);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (apiKey) formData.append('api_key', apiKey);

    try {
      const res = await axios.post(`${API_BASE}/api/extract-file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setExtractionProgress(100);
      setExtractionStage('Extraction Complete');
      setExtractedData(res.data.extracted);
      setChatMessages([
        {
          sender: 'assistant',
          text: `File parsed successfully! Extracted details for **${res.data.extracted.product_name || 'Product'}** (Batch: ${res.data.extracted.batch_lot_number || 'N/A'}). How can I assist with your QA Triage?`
        }
      ]);
    } catch (err) {
      alert('Error extracting file: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!extractedData) return;
    try {
      await axios.post(`${API_BASE}/api/complaints`, extractedData);
      setSaveSuccess(true);
      fetchComplaints();
    } catch (err) {
      alert('Failed to save to database: ' + err.message);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !extractedData) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setIsChatting(true);

    try {
      const res = await axios.post(`${API_BASE}/api/chat`, {
        complaint_context: extractedData,
        user_question: userMsg,
        api_key: apiKey
      });
      setChatMessages((prev) => [...prev, { sender: 'assistant', text: res.data.reply }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { sender: 'assistant', text: 'Error contacting AI assistant.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  const fetchComplaints = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/complaints`);
      setComplaints(res.data);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const filteredComplaints = complaints.filter(c => 
    (c.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.batch_lot_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <header className="app-header">
        <div className="brand-badge">
          <ShieldCheck className="w-7 h-7 text-blue-500" />
          <span>PharmaQMS <span className="text-purple-400 font-normal text-sm">AI Complaint Triage</span></span>
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
            cGMP Complaint Log ({complaints.length})
          </button>
        </div>

        {/* API Key Modal Input */}
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

      {/* Main App Workspace */}
      <main className="main-content flex-1">
        {activeTab === 'intake' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Raw Intake Input */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Document Text Input Card */}
              <div className="card">
                <div className="card-title">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Complaint Text / Document Input
                </div>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => loadSample('oos')}
                    className="btn btn-secondary text-xs py-1 px-2.5"
                  >
                    Sample OOS (Chemical)
                  </button>
                  <button
                    onClick={() => loadSample('discoloration')}
                    className="btn btn-secondary text-xs py-1 px-2.5"
                  >
                    Sample Discoloration (FDF)
                  </button>
                </div>

                <textarea
                  rows={8}
                  className="textarea-field text-sm"
                  placeholder="Paste unstructured complaint email, customer memo, or OOS non-conformance report here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleTextExtract}
                    disabled={isExtracting || !rawText.trim()}
                    className="btn btn-primary w-full"
                  >
                    {isExtracting ? (
                      <>
                        <Zap className="w-4 h-4 animate-spin" />
                        Extracting Metadata...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Run AI Structured Extraction
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* File Upload Intake Card */}
              <div className="card">
                <div className="card-title">
                  <Upload className="w-5 h-5 text-purple-400" />
                  Upload Complaint Document (PDF / DOCX / TXT)
                </div>

                <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center bg-slate-900/50 hover:border-blue-500/50 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.eml"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <FileSpreadsheet className="w-10 h-10 text-slate-400 mb-1" />
                    <span className="text-sm font-medium text-slate-200">
                      {selectedFile ? selectedFile.name : 'Click to select PDF or Word report'}
                    </span>
                    <span className="text-xs text-slate-500">Supports PDF, DOCX, TXT formats</span>
                  </label>
                </div>

                {selectedFile && (
                  <div className="mt-3">
                    <button
                      onClick={handleFileExtract}
                      disabled={isExtracting}
                      className="btn btn-secondary w-full"
                    >
                      <Upload className="w-4 h-4" />
                      Parse File Attachment
                    </button>
                  </div>
                )}
              </div>

              {/* Progress Indicator */}
              {isExtracting && (
                <div className="card bg-blue-950/30 border-blue-800/50">
                  <div className="flex justify-between text-xs text-blue-300 mb-1">
                    <span>{extractionStage}</span>
                    <span>{extractionProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${extractionProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: AI Extraction & QA Assistant */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {extractedData ? (
                <>
                  {/* Extracted Metadata Dashboard */}
                  <div className="card border-blue-500/30">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="card-title mb-1">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          Extracted cGMP Complaint Record
                        </div>
                        <p className="text-xs text-slate-400">Structured parameters auto-tagged for Quality Assurance audit trail.</p>
                      </div>
                      
                      <button
                        onClick={handleSaveToDatabase}
                        className={`btn text-xs ${saveSuccess ? 'bg-emerald-600 hover:bg-emerald-500' : 'btn-primary'}`}
                      >
                        {saveSuccess ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Logged to Database
                          </>
                        ) : (
                          <>
                            <Database className="w-4 h-4" />
                            Save to QMS Database
                          </>
                        )}
                      </button>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-xs">
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block mb-1">Customer / Reporter</span>
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          {extractedData.customer_name || 'N/A'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block mb-1">Product Name</span>
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-purple-400" />
                          {extractedData.product_name || 'N/A'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block mb-1">Batch / Lot #</span>
                        <span className="font-semibold text-blue-400 font-mono">
                          {extractedData.batch_lot_number || 'N/A'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block mb-1">Strength / Grade</span>
                        <span className="font-semibold text-slate-200">
                          {extractedData.product_strength_grade || 'N/A'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block mb-1">Mfg / Expiry Date</span>
                        <span className="font-semibold text-slate-200 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {extractedData.manufacturing_date || 'N/A'} / {extractedData.expiry_date || 'N/A'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block mb-1">Quantity Affected</span>
                        <span className="font-semibold text-slate-200">
                          {extractedData.quantity_affected || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Risk Triage Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Severity Assessment:</span>
                        <span className={`badge ${
                          extractedData.initial_severity === 'Critical' ? 'badge-critical' :
                          extractedData.initial_severity === 'Major' ? 'badge-major' : 'badge-minor'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          {extractedData.initial_severity || 'Minor'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Priority Level:</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/50">
                          {extractedData.priority || 'Medium'} Priority
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Category:</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/50">
                          {extractedData.complaint_type || 'General Defect'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive QA Assistant Chatbot */}
                  <div className="card flex-1 flex flex-col h-[400px]">
                    <div className="card-title mb-2">
                      <Bot className="w-5 h-5 text-teal-400" />
                      QA Copilot Assistant
                    </div>
                    <p className="text-xs text-slate-400 mb-3">Ask questions about risk evaluation, CAPA guidelines, or batch background details.</p>

                    {/* Chat Messages Window */}
                    <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-900/90 rounded-lg border border-slate-800 mb-3">
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2.5 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.sender === 'assistant' && (
                            <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                              <Bot className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div
                            className={`p-3 rounded-xl max-w-[80%] leading-relaxed ${
                              msg.sender === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {isChatting && (
                        <div className="text-xs text-slate-500 italic flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 animate-spin" />
                          QA Assistant is formulating response...
                        </div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. What CAPA actions are recommended for this batch?"
                        className="input-field text-xs"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      />
                      <button onClick={handleSendChat} disabled={isChatting} className="btn btn-primary py-2 px-3">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card h-full flex flex-col items-center justify-center text-center py-16 text-slate-500">
                  <Layers className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="text-base font-medium text-slate-400">No Active Complaint Record Extracted</p>
                  <p className="text-xs max-w-sm mt-1">Paste complaint text or upload a document report on the left panel to execute automated cGMP triage.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Log Records Database */}
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

            {/* Records Table */}
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
                  {filteredComplaints.length > 0 ? (
                    filteredComplaints.map((c) => (
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No complaints logged in database yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
