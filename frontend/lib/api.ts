export const API_BASE = (function () {
  // Use environment variable if provided (baked in at build time)
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  // Dynamic detection for browser environment
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If running on a cloud run domain, use the known backend URL
    if (hostname.includes('.run.app')) {
      return "https://loantwin-backend-fozkypxpga-uc.a.run.app";
    }
  }

  // Default for local development
  return "http://localhost:8008";
})();

async function handle(res: Response) {
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json();
}

export async function createLoan(name: string) {
  return handle(await fetch(`${API_BASE}/api/loans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  }));
}

export async function createSampleLoan() {
  return handle(await fetch(`${API_BASE}/api/loans/sample`, { method: "POST" }));
}

export async function socialLogin(full_name: string, email: string, social_provider: string) {
  return handle(await fetch(`${API_BASE}/api/auth/social-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name, email, social_provider })
  }));
}

export async function login(email: string, password: string) {
  return handle(await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  }));
}

export async function register(full_name: string, email: string, password: string) {
  return handle(await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name, email, password })
  }));
}

export async function fetchLoan(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}`));
}

// Global search for deals and clauses
export async function globalSearch(query: string, limit: number = 20) {
  return handle(await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`));
}

export async function uploadDoc(loanId: number, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/documents`, { method: "POST", body: fd }));
}

export async function getLoanDocuments(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/documents`));
}

export async function processDoc(loanId: number, documentId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/process-document/${documentId}`, { method: "POST" }));
}

export async function getDLR(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/dlr`));
}

export async function getClauses(loanId: number, query?: string) {
  const q = query ? `?query=${encodeURIComponent(query)}` : "";
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/clauses${q}`));
}

export async function getObligations(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/obligations`));
}

export async function updateObligation(loanId: number, obligationId: number, updates: { status?: string; evidence_path?: string; assigned_to?: string }) {
  const params = new URLSearchParams();
  if (updates.status) params.append('status', updates.status);
  if (updates.evidence_path) params.append('evidence_path', updates.evidence_path);
  if (updates.assigned_to) params.append('assigned_to', updates.assigned_to);

  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/obligations/${obligationId}?${params.toString()}`, {
    method: "PATCH"
  }));
}

export async function getTradePack(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/trade-pack`));
}

export function getDocumentUrl(documentId: number) {
  return `${API_BASE}/api/documents/${documentId}/file`;
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function getLoanStats(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/stats`));
}

export async function getAuditLogs(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/audit-logs`));
}

export async function getResolveQueue(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/resolve-queue`));
}

export async function getCounterparties(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/counterparties`));
}

export async function getTransferInfo(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/transfer-info`));
}

// ============ AGENTIC AI APIs ============

export async function getAgentRecommendations(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/agent/recommendations/${loanId}`));
}

export async function executeAgentAction(loanId: number, recommendationId: string) {
  return handle(await fetch(`${API_BASE}/api/agent/execute/${loanId}/${recommendationId}`, { method: "POST" }));
}

export async function runAgentWorkflow(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/agent/workflow/${loanId}`, { method: "POST" }));
}

export async function getApprovalQueue(loanId?: number) {
  const url = loanId ? `${API_BASE}/api/agent/approval-queue?loan_id=${loanId}` : `${API_BASE}/api/agent/approval-queue`;
  return handle(await fetch(url));
}

export async function getActionDraft(actionId: string) {
  return handle(await fetch(`${API_BASE}/api/agent/approval-queue/${actionId}/draft`));
}

export async function approveAction(actionId: string) {
  return handle(await fetch(`${API_BASE}/api/agent/approve/${actionId}`, { method: "POST" }));
}

export async function rejectAction(actionId: string, reason?: string) {
  const url = reason ? `${API_BASE}/api/agent/reject/${actionId}?reason=${encodeURIComponent(reason)}` : `${API_BASE}/api/agent/reject/${actionId}`;
  return handle(await fetch(url, { method: "POST" }));
}

export async function getMarketplaceData(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/agent/marketplace/${loanId}`));
}

export async function initiateTrade(
  loanId: number,
  buyerId: string,
  amount: number,
  pricePercent: number = 99.5,
  tradeType: string = "assignment",
  settlementDate?: string
) {
  const params = new URLSearchParams({
    buyer_id: buyerId,
    amount: amount.toString(),
    price_percent: pricePercent.toString(),
    trade_type: tradeType,
  });
  if (settlementDate) params.append("settlement_date", settlementDate);

  return handle(await fetch(`${API_BASE}/api/agent/marketplace/${loanId}/initiate-trade?${params}`, { method: "POST" }));
}

export async function getTradeStatus(tradeId: string) {
  return handle(await fetch(`${API_BASE}/api/agent/trades/${tradeId}`));
}

export async function getLoanTrades(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/agent/marketplace/${loanId}/trades`));
}

export async function confirmTrade(tradeId: string) {
  return handle(await fetch(`${API_BASE}/api/agent/trades/${tradeId}/confirm`, { method: "POST" }));
}

export async function settleTrade(tradeId: string) {
  return handle(await fetch(`${API_BASE}/api/agent/trades/${tradeId}/settle`, { method: "POST" }));
}

export async function requestWaiver(loanId: number, buyerId: string, buyerName: string) {
  return handle(await fetch(`${API_BASE}/api/agent/marketplace/${loanId}/request-waiver?buyer_id=${buyerId}&buyer_name=${encodeURIComponent(buyerName)}`, { method: "POST" }));
}

export async function getStressScenarios(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/agent/stress-test/${loanId}`));
}

export async function runStressTest(loanId: number, scenarioName: string) {
  return handle(await fetch(`${API_BASE}/api/agent/stress-test/${loanId}/run?scenario_name=${encodeURIComponent(scenarioName)}`, { method: "POST" }));
}

export async function getEsgMargins(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/agent/esg-margins/${loanId}`));
}

export async function simulateEsgMargin(loanId: number, kpiName: string, newValue: number) {
  return handle(await fetch(`${API_BASE}/api/agent/esg-margins/${loanId}/simulate?kpi_name=${encodeURIComponent(kpiName)}&new_value=${newValue}`, { method: "POST" }));
}

// ============ MARKET INTELLIGENCE APIs ============

export async function getDistanceToDefault(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/distance-to-default/${loanId}`));
}

export async function getCapitalStructure(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/capital-structure/${loanId}`));
}

export async function getPricingGrid(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/pricing-grid/${loanId}`));
}

export async function getTokenizedSettlement(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/tokenized-settlement/${loanId}`));
}

export async function getBlockchainFeatures(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/blockchain/${loanId}`));
}

export async function getLmaCompliance(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/lma-compliance/${loanId}`));
}

export async function getComplianceShield(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/compliance-shield/${loanId}`));
}

export async function getTradeReadinessExplained(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/xai/trade-readiness/${loanId}`));
}

export async function getMarketAlerts(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/market/market-alerts/${loanId}`));
}

// ============ EXPORT FUNCTIONS ============

export function exportToJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Build CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle nested objects, arrays, and special characters
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportDealToExcel(loanData: any, stats: any, filename: string) {
  // Create multiple sheets as separate CSVs in a structured format
  const sheets: any = {};

  // Sheet 1: Deal Summary
  sheets.summary = [{
    'Field': 'Deal Name', 'Value': loanData.name || 'N/A',
  }, {
    'Field': 'Borrower', 'Value': loanData.borrower_name || 'N/A',
  }, {
    'Field': 'Total Commitment', 'Value': stats?.total_commitments || 'N/A',
  }, {
    'Field': 'Currency', 'Value': stats?.currency || 'USD',
  }, {
    'Field': 'Governing Law', 'Value': loanData.governing_law || 'N/A',
  }, {
    'Field': 'Trade Readiness', 'Value': `${stats?.trade_readiness_score || 0}%`,
  }, {
    'Field': 'ESG Linked', 'Value': stats?.is_esg_linked ? 'Yes' : 'No',
  }];

  // Sheet 2: Facilities (if available)
  if (loanData.dlr_json?.facilities) {
    sheets.facilities = loanData.dlr_json.facilities.map((f: any) => ({
      'Facility': f.name,
      'Type': f.type,
      'Amount': f.amount,
      'Currency': f.currency,
      'Maturity': f.maturity_date,
      'Margin': f.margin
    }));
  }

  // Sheet 3: Key Dates
  if (loanData.dlr_json?.dates) {
    sheets.dates = Object.entries(loanData.dlr_json.dates).map(([key, value]) => ({
      'Date Type': key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      'Date': value
    }));
  }

  // Export as JSON with Excel-friendly structure
  const excelData = {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'LoanTwin OS',
      version: '2.5'
    },
    ...sheets,
    raw_dlr: loanData.dlr_json
  };

  exportToJSON(excelData, filename);
}

export function exportAuditReport(loanData: any, stats: any, recommendations: any[], auditLogs: any[], filename: string) {
  const report = {
    _report_metadata: {
      title: 'LoanTwin OS Audit Report',
      generated_at: new Date().toISOString(),
      deal_name: loanData?.name || 'Unknown',
      version: '2.5'
    },
    executive_summary: {
      total_commitment: stats?.total_commitments,
      currency: stats?.currency,
      trade_readiness_score: stats?.trade_readiness_score,
      open_obligations: stats?.open_obligations,
      overdue_obligations: stats?.overdue_obligations,
      high_risk_items: stats?.high_risk_blocks,
      esg_linked: stats?.is_esg_linked
    },
    ai_recommendations: recommendations.map(r => ({
      id: r.id,
      severity: r.severity,
      title: r.title,
      description: r.description,
      ai_recommendation: r.ai_recommendation,
      confidence: r.confidence,
      status: 'pending'
    })),
    audit_trail: auditLogs || [],
    deal_data: loanData?.dlr_json || {},
    compliance_notes: [
      { standard: 'LMA', status: 'Aligned', notes: 'Document structure follows LMA recommended forms' },
      { standard: 'GDPR', status: 'Compliant', notes: 'No PII exposed in exports' }
    ]
  };

  exportToJSON(report, filename);
}

export function printDealReport(loanData: any, stats: any) {
  // Create a printable HTML document
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>LoanTwin OS - Deal Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
        h2 { color: #2563eb; margin-top: 30px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #1e3a5f; }
        .meta { color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: 600; }
        .kpi { display: inline-block; margin: 10px; padding: 15px; background: #f8fafc; border-radius: 8px; min-width: 150px; }
        .kpi-value { font-size: 24px; font-weight: bold; color: #1e3a5f; }
        .kpi-label { font-size: 12px; color: #666; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🏦 LoanTwin OS</div>
        <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      </div>
      
      <h1>${loanData?.name || 'Deal Report'}</h1>
      
      <h2>Executive Summary</h2>
      <div>
        <div class="kpi">
          <div class="kpi-value">${stats?.total_commitments?.toLocaleString() || 'N/A'}</div>
          <div class="kpi-label">Total Commitment (${stats?.currency || 'USD'})</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${stats?.trade_readiness_score || 0}%</div>
          <div class="kpi-label">Trade Readiness</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${stats?.open_obligations || 0}</div>
          <div class="kpi-label">Open Obligations</div>
        </div>
      </div>
      
      <h2>Deal Information</h2>
      <table>
        <tr><th>Borrower</th><td>${loanData?.borrower_name || 'N/A'}</td></tr>
        <tr><th>Governing Law</th><td>${loanData?.governing_law || 'N/A'}</td></tr>
        <tr><th>Facility Type</th><td>${loanData?.facility_type || 'N/A'}</td></tr>
        <tr><th>ESG Linked</th><td>${stats?.is_esg_linked ? 'Yes' : 'No'}</td></tr>
      </table>
      
      <div class="footer">
        <p>This report was generated by LoanTwin OS Enterprise v2.5</p>
        <p>© 2026 LoanTwin OS. Confidential - For authorized recipients only.</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  }
}

// ============ VOICE AI ============

export async function sendVoiceQuery(text: string, loanId?: number, context?: any) {
  return handle(await fetch(`${API_BASE}/api/voice/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, loan_id: loanId, context })
  }));
}

export async function getVoiceCapabilities() {
  return handle(await fetch(`${API_BASE}/api/voice/capabilities`));
}

export async function getQuickVoiceActions(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/voice/quick-actions?loan_id=${loanId}`));
}

// ============ VIDEO GENERATION ============

export async function generateVideoBriefing(loanId: number, videoType: string, personalization: any = {}) {
  return handle(await fetch(`${API_BASE}/api/exports/generate-briefing/${loanId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_type: videoType, personalization })
  }));
}

export async function getBriefingStatus(jobId: string) {
  return handle(await fetch(`${API_BASE}/api/exports/briefing-status/${jobId}`));
}

export async function getBriefing(jobId: string) {
  return handle(await fetch(`${API_BASE}/api/exports/briefing/${jobId}`));
}

export async function listBriefings(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/exports/briefings/${loanId}`));
}

export async function generateDealRoadshow(loanId: number, recipients: string[] = [], template: string = "investor_teaser") {
  return handle(await fetch(`${API_BASE}/api/exports/generate-roadshow/${loanId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipients, template })
  }));
}

export async function getVideoTypes() {
  return handle(await fetch(`${API_BASE}/api/exports/video-types`));
}

export async function previewVideoScript(loanId: number, videoType: string = "daily_update") {
  return handle(await fetch(`${API_BASE}/api/exports/preview-script/${loanId}?video_type=${videoType}`));
}

// ============ VIDEO RENDERING ============

export async function renderVideo(jobId: string, options: {
  avatarStyle?: string;
  background?: string;
  resolution?: string;
} = {}) {
  return handle(await fetch(`${API_BASE}/api/exports/render-video/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      avatar_style: options.avatarStyle || "professional_female",
      background: options.background || "office",
      resolution: options.resolution || "1080p"
    })
  }));
}

export async function getRenderStatus(renderId: string) {
  return handle(await fetch(`${API_BASE}/api/exports/render-status/${renderId}`));
}

export async function listRenders(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/exports/renders/${loanId}`));
}

// ============ EVENT HISTORY / AUDIT LOGS ============

export async function getEventHistory(loanId?: number, limit: number = 50) {
  const params = new URLSearchParams();
  if (loanId) params.append('loan_id', loanId.toString());
  params.append('limit', limit.toString());
  return handle(await fetch(`${API_BASE}/api/audit/logs?${params}`));
}

export async function recordEvent(loanId: number, action: string, details: string) {
  return handle(await fetch(`${API_BASE}/api/audit/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loan_id: loanId, action, details })
  }));
}

// ============ WORKFLOWS ============

export async function listWorkflows(loanId?: number) {
  const url = loanId ? `${API_BASE}/api/workflows?loan_id=${loanId}` : `${API_BASE}/api/workflows`;
  return handle(await fetch(url));
}

export async function getWorkflow(workflowId: string) {
  return handle(await fetch(`${API_BASE}/api/workflows/${workflowId}`));
}

export async function toggleWorkflow(workflowId: string, enabled: boolean) {
  return handle(await fetch(`${API_BASE}/api/workflows/${workflowId}/toggle?enabled=${enabled}`, { method: "POST" }));
}

export async function executeWorkflow(workflowId: string, loanId: number, context: any = {}) {
  return handle(await fetch(`${API_BASE}/api/workflows/execute/${workflowId}/${loanId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context)
  }));
}

export async function getWorkflowExecutions(loanId?: number) {
  const url = loanId ? `${API_BASE}/api/workflows/executions?loan_id=${loanId}` : `${API_BASE}/api/workflows/executions`;
  return handle(await fetch(url));
}

// ============ SUPPORT ============

export async function analyzeContext(context: any) {
  return handle(await fetch(`${API_BASE}/api/support/analyze-context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context)
  }));
}

export async function getSuggestedActions(loanId?: number, route: string = "/") {
  return handle(await fetch(`${API_BASE}/api/support/suggested-actions?loan_id=${loanId || ''}&route=${encodeURIComponent(route)}`));
}

export async function diagnoseIssue(errorMessage: string, filePath?: string, additionalContext: any = {}) {
  return handle(await fetch(`${API_BASE}/api/support/diagnose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error_message: errorMessage, file_path: filePath, additional_context: additionalContext })
  }));
}

export async function attemptSelfHeal(errorMessage: string, filePath?: string, additionalContext: any = {}) {
  return handle(await fetch(`${API_BASE}/api/support/self-heal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error_message: errorMessage, file_path: filePath, additional_context: additionalContext })
  }));
}

export async function getQuickHelp(topic: string) {
  return handle(await fetch(`${API_BASE}/api/support/quick-help/${topic}`));
}

export async function getFaq() {
  return handle(await fetch(`${API_BASE}/api/support/faq`));
}

// ============ DATA IMPORT APIs ============

export async function uploadCSV(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return handle(await fetch(`${API_BASE}/api/import/csv/upload`, { method: "POST", body: fd }));
}

export async function fetchFromURL(url: string, sourceName?: string) {
  return handle(await fetch(`${API_BASE}/api/import/url/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, source_name: sourceName })
  }));
}

export async function getImportFields() {
  return handle(await fetch(`${API_BASE}/api/import/fields`));
}

export async function executeImport(jobId: number, mapping: Record<string, string>) {
  return handle(await fetch(`${API_BASE}/api/import/execute/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapping })
  }));
}

export async function getImportJobs() {
  return handle(await fetch(`${API_BASE}/api/import/jobs`));
}

export async function getImportJob(jobId: number) {
  return handle(await fetch(`${API_BASE}/api/import/jobs/${jobId}`));
}

export async function getLoanApplications(limit?: number, offset?: number, status?: string) {
  let url = `${API_BASE}/api/import/applications?limit=${limit || 100}&offset=${offset || 0}`;
  if (status) url += `&status=${status}`;
  return handle(await fetch(url));
}

export async function getLoanApplication(appId: number) {
  return handle(await fetch(`${API_BASE}/api/import/applications/${appId}`));
}

// ============ CREDIT RISK APIs ============

export async function assessLoan(loanData: {
  loan_amount: number;
  term_months: number;
  interest_rate: number;
  grade: string;
  annual_income: number;
  dti: number;
  home_ownership?: string;
  employment_length?: string;
  purpose?: string;
  delinq_2yrs?: number;
  pub_rec?: number;
  revol_util?: number;
}) {
  return handle(await fetch(`${API_BASE}/api/risk/assess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loanData)
  }));
}

export async function assessExistingApplication(applicationId: number) {
  return handle(await fetch(`${API_BASE}/api/risk/assess/${applicationId}`, { method: "POST" }));
}

export async function batchAssess(limit?: number) {
  return handle(await fetch(`${API_BASE}/api/risk/batch?limit=${limit || 100}`, { method: "POST" }));
}

export async function getPortfolioRisk() {
  return handle(await fetch(`${API_BASE}/api/risk/portfolio`));
}

export async function getPredictedDefaults(threshold?: number, limit?: number) {
  let url = `${API_BASE}/api/risk/defaults?`;
  if (threshold) url += `threshold=${threshold}&`;
  if (limit) url += `limit=${limit}`;
  return handle(await fetch(url));
}

export async function trainRiskModel() {
  return handle(await fetch(`${API_BASE}/api/risk/train`, { method: "POST" }));
}

export async function loadDemoPortfolio(count?: number) {
  return handle(await fetch(`${API_BASE}/api/risk/demo/load?count=${count || 500}`, { method: "POST" }));
}

export async function getDemoStats() {
  return handle(await fetch(`${API_BASE}/api/risk/demo/stats`));
}

export async function clearDemoData() {
  return handle(await fetch(`${API_BASE}/api/risk/demo/clear`, { method: "DELETE" }));
}

export async function getRiskHealth() {
  return handle(await fetch(`${API_BASE}/api/risk/health`));
}

// ============ VETTING APIs ============

export async function getDocumentChecklist(loanType: string) {
  return handle(await fetch(`${API_BASE}/api/vetting/checklist/${loanType}`));
}

export async function getAllChecklists() {
  return handle(await fetch(`${API_BASE}/api/vetting/checklists`));
}

export async function getVettingStatus(applicationId: number) {
  return handle(await fetch(`${API_BASE}/api/vetting/status/${applicationId}`));
}

export async function submitVettingDocument(applicationId: number, requirementId: number, file: File) {
  const fd = new FormData();
  fd.append("requirement_id", String(requirementId));
  fd.append("file", file);
  return handle(await fetch(`${API_BASE}/api/vetting/submit/${applicationId}`, { method: "POST", body: fd }));
}

export async function verifyDocument(submissionId: number, verified: boolean, rejectionReason?: string) {
  return handle(await fetch(`${API_BASE}/api/vetting/verify/${submissionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verified, rejection_reason: rejectionReason })
  }));
}

export async function getVerificationQueue() {
  return handle(await fetch(`${API_BASE}/api/vetting/queue`));
}

export async function aiVerifyDocument(submissionId: number) {
  return handle(await fetch(`${API_BASE}/api/vetting/ai-verify/${submissionId}`, { method: "POST" }));
}

export async function checkReadyForApproval(applicationId: number) {
  return handle(await fetch(`${API_BASE}/api/vetting/ready/${applicationId}`));
}

export async function seedDocumentRequirements() {
  return handle(await fetch(`${API_BASE}/api/vetting/seed-requirements`, { method: "POST" }));
}

// ============ EXPERT NETWORK APIs ============

export async function listExperts(options?: { category?: string; jurisdiction?: string; verified_only?: boolean; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.category) params.append("category", options.category);
  if (options?.jurisdiction) params.append("jurisdiction", options.jurisdiction);
  if (options?.verified_only) params.append("verified_only", "true");
  if (options?.limit) params.append("limit", String(options.limit));
  return handle(await fetch(`${API_BASE}/api/experts?${params}`));
}

export async function getExpert(expertId: number) {
  return handle(await fetch(`${API_BASE}/api/experts/${expertId}`));
}

export async function getExpertsMapData(options?: { category?: string; jurisdiction?: string }) {
  const params = new URLSearchParams();
  if (options?.category) params.append("category", options.category);
  if (options?.jurisdiction) params.append("jurisdiction", options.jurisdiction);
  return handle(await fetch(`${API_BASE}/api/experts/map?${params}`));
}

export async function createExpertIssue(issue: { loan_id: number; category: string; severity: string; title: string; description: string }) {
  return handle(await fetch(`${API_BASE}/api/experts/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(issue)
  }));
}

export async function triageIssue(issueId: number) {
  return handle(await fetch(`${API_BASE}/api/experts/issues/${issueId}/triage`, { method: "POST" }));
}

export async function listExpertIssues(options?: { status?: string; loan_id?: number }) {
  const params = new URLSearchParams();
  if (options?.status) params.append("status", options.status);
  if (options?.loan_id) params.append("loan_id", String(options.loan_id));
  return handle(await fetch(`${API_BASE}/api/experts/issues?${params}`));
}

export async function draftEngagement(request: { issue_id: number; expert_id: number; scope_of_work: string; estimated_hours: number }) {
  return handle(await fetch(`${API_BASE}/api/experts/engagements/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  }));
}

export async function approveEngagement(engagementId: number) {
  return handle(await fetch(`${API_BASE}/api/experts/engagements/${engagementId}/approve`, { method: "POST" }));
}

export async function getPendingEngagements() {
  return handle(await fetch(`${API_BASE}/api/experts/engagements/pending`));
}

export async function seedDemoExperts() {
  return handle(await fetch(`${API_BASE}/api/experts/demo/seed`, { method: "POST" }));
}

export async function searchRealExperts(params: {
  zip_code: string;
  country?: string;
  expert_type?: string;
  issue_description: string;
  radius_miles?: number;
}) {
  return handle(await fetch(`${API_BASE}/api/experts/search/realtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zip_code: params.zip_code,
      country: params.country || "US",
      expert_type: params.expert_type || "legal",
      issue_description: params.issue_description,
      radius_miles: params.radius_miles || 50
    })
  }));
}

export async function geocodeZipCode(zipCode: string, country?: string) {
  return handle(await fetch(`${API_BASE}/api/experts/search/geocode/${zipCode}?country=${country || "US"}`));
}

export async function findNearbyExperts(params: {
  zip_code: string;
  expert_type?: string;
  radius_miles?: number;
  country?: string;
}) {
  const queryParams = new URLSearchParams({
    zip_code: params.zip_code,
    expert_type: params.expert_type || "legal",
    radius_miles: String(params.radius_miles || 50),
    country: params.country || "US"
  });
  return handle(await fetch(`${API_BASE}/api/experts/search/nearby?${queryParams}`, { method: "POST" }));
}

export async function getMapConfig() {
  return handle(await fetch(`${API_BASE}/api/experts/map/config`));
}

export async function getPlaceDetails(placeId: string) {
  return handle(await fetch(`${API_BASE}/api/experts/search/places/${placeId}`));
}

// ============ COVENANT MONITORING APIs ============

export async function getLoanCovenants(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/covenants/${loanId}`));
}

export async function createCovenant(covenant: { loan_id: number; covenant_type: string; name: string; description: string; threshold: string; test_frequency?: string }) {
  return handle(await fetch(`${API_BASE}/api/covenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(covenant)
  }));
}

export async function extractCovenants(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/covenants/extract/${loanId}`, { method: "POST" }));
}

export async function recordCovenantTest(test: { covenant_id: number; test_date: string; reporting_period: string; actual_value: string }) {
  return handle(await fetch(`${API_BASE}/api/covenants/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(test)
  }));
}

export async function getActiveBreaches(loanId?: number) {
  const url = loanId ? `${API_BASE}/api/covenants/breaches?loan_id=${loanId}` : `${API_BASE}/api/covenants/breaches`;
  return handle(await fetch(url));
}

export async function getCovenantDashboard() {
  return handle(await fetch(`${API_BASE}/api/covenants/dashboard`));
}

export async function cureCovenantBreach(testId: number, notes: string) {
  return handle(await fetch(`${API_BASE}/api/covenants/cure/${testId}?notes=${encodeURIComponent(notes)}`, { method: "POST" }));
}

export async function waiveCovenantBreach(testId: number, notes: string) {
  return handle(await fetch(`${API_BASE}/api/covenants/waive/${testId}?waiver_notes=${encodeURIComponent(notes)}`, { method: "POST" }));
}

// ============ LMA INTEGRATION APIs ============

export async function getLmaConfig() {
  return handle(await fetch(`${API_BASE}/api/lma/config`));
}

export async function getLmaTemplateMappings() {
  return handle(await fetch(`${API_BASE}/api/lma/templates`));
}

export async function getLmaSyncStatus(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/lma/sync-status/${loanId}`));
}

export async function testLmaConnection() {
  return handle(await fetch(`${API_BASE}/api/lma/test-connection`, { method: "POST" }));
}

export async function importFromLma(document: any) {
  return handle(await fetch(`${API_BASE}/api/lma/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document)
  }));
}

// ============ GROQ AI APIs ============

export async function aiTriage(applicationData: any) {
  return handle(await fetch(`${API_BASE}/api/ai/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application_data: applicationData })
  }));
}

export async function aiExplainRisk(applicationId: number) {
  return handle(await fetch(`${API_BASE}/api/ai/explain-risk/${applicationId}`, { method: "POST" }));
}

export async function aiAnalyzeDocument(documentText: string, analysisType: string) {
  return handle(await fetch(`${API_BASE}/api/ai/analyze-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_text: documentText, analysis_type: analysisType })
  }));
}

export async function aiClassifyIssue(issueDescription: string) {
  return handle(await fetch(`${API_BASE}/api/ai/classify-issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_description: issueDescription })
  }));
}

export async function aiInterpretCovenant(covenantText: string, loanData: any) {
  return handle(await fetch(`${API_BASE}/api/ai/interpret-covenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ covenant_text: covenantText, loan_data: loanData })
  }));
}

export async function aiDraftEngagement(engagementDetails: any) {
  return handle(await fetch(`${API_BASE}/api/ai/draft-engagement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engagement_details: engagementDetails })
  }));
}

export async function aiChat(message: string, model?: string) {
  return handle(await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model: model || "llama-3.3-70b-versatile" })
  }));
}

export async function aiChatStream(message: string, model?: string): Promise<ReadableStream> {
  const res = await fetch(`${API_BASE}/api/ai/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model: model || "llama-3.3-70b-versatile" })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.body!;
}

export async function getAiModels() {
  return handle(await fetch(`${API_BASE}/api/ai/models`));
}

export async function getAiHealth() {
  return handle(await fetch(`${API_BASE}/api/ai/health`));
}

// ============ AUDIT APIs ============

export async function getAuditLogsGeneral(options?: { resource_type?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.resource_type) params.append("resource_type", options.resource_type);
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.offset) params.append("offset", String(options.offset));
  return handle(await fetch(`${API_BASE}/api/audit/logs?${params}`));
}

export async function getResourceAuditLogs(resourceType: string, resourceId: number) {
  return handle(await fetch(`${API_BASE}/api/audit/logs/resource/${resourceType}/${resourceId}`));
}

export async function getUserAuditLogs(userId: number) {
  return handle(await fetch(`${API_BASE}/api/audit/logs/user/${userId}`));
}

export async function verifyAuditLogs() {
  return handle(await fetch(`${API_BASE}/api/audit/logs/verify`));
}

export async function exportAuditLogs(options?: { start_date?: string; end_date?: string; format?: string }) {
  const params = new URLSearchParams();
  if (options?.start_date) params.append("start_date", options.start_date);
  if (options?.end_date) params.append("end_date", options.end_date);
  if (options?.format) params.append("format", options.format);
  return handle(await fetch(`${API_BASE}/api/audit/logs/export?${params}`));
}

export async function getAuditSummary(days?: number) {
  return handle(await fetch(`${API_BASE}/api/audit/logs/summary${days ? `?days=${days}` : ''}`));
}

export async function recordAuditLog(log: { resource_type: string; resource_id: number; action: string; details?: any }) {
  return handle(await fetch(`${API_BASE}/api/audit/logs/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(log)
  }));
}

export async function getLoginAttempts(options?: { status?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.status) params.append("status", options.status);
  if (options?.limit) params.append("limit", String(options.limit));
  return handle(await fetch(`${API_BASE}/api/audit/security/login-attempts?${params}`));
}

export async function getSensitiveOperations(limit?: number) {
  return handle(await fetch(`${API_BASE}/api/audit/security/sensitive-operations${limit ? `?limit=${limit}` : ''}`));
}

// ============ ADVANCED RISK APIs ============

export async function getRiskModelStats() {
  return handle(await fetch(`${API_BASE}/api/risk/model/stats`));
}

export async function getShapValues(applicationId: number) {
  return handle(await fetch(`${API_BASE}/api/risk/shap/${applicationId}`));
}

export async function runWhatIfAnalysis(applicationId: number, changes: any) {
  return handle(await fetch(`${API_BASE}/api/risk/what-if`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application_id: applicationId, changes })
  }));
}

export async function validateFeatures() {
  return handle(await fetch(`${API_BASE}/api/risk/features/validate`));
}

export async function getFeatureStatistics() {
  return handle(await fetch(`${API_BASE}/api/risk/features/statistics`));
}

export async function getFeatureOutliers(feature: string) {
  return handle(await fetch(`${API_BASE}/api/risk/features/outliers/${feature}`));
}

export async function getFeatureReport() {
  return handle(await fetch(`${API_BASE}/api/risk/features/report`));
}

export async function engineerFeatures(applicationId: number) {
  return handle(await fetch(`${API_BASE}/api/risk/features/engineer/${applicationId}`, { method: "POST" }));
}

// ============ LOAN AI CHAT ============

export async function chatWithLoan(loanId: number, message: string, history?: any[]) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history: history || [] })
  }));
}
