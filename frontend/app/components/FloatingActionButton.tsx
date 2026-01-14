'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLoan } from '../../lib/LoanContext';
import { runAgentWorkflow, generateVideoBriefing, renderVideo, getRenderStatus } from '../../lib/api';
import { Plus, X, Zap, ScanSearch, Video, CheckCircle, FileText, Play, Loader2, Download, User } from 'lucide-react';

interface FloatingActionButtonProps {
  onQuickTrade?: () => void;
  onAiScan?: () => void;
  onVideoGenerated?: (result: any) => void;
}

export default function FloatingActionButton({ 
  onQuickTrade, 
  onAiScan,
  onVideoGenerated
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoResult, setVideoResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<string>('idle');
  const [selectedAvatar, setSelectedAvatar] = useState('professional_female');
  const renderPollRef = useRef<NodeJS.Timeout | null>(null);
  const { activeLoanId, loanName } = useLoan();
  const router = useRouter();

  // Ensure we're on client side for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (renderPollRef.current) clearInterval(renderPollRef.current);
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    window.dispatchEvent(new CustomEvent('loantwin-toast', { detail: { message, type } }));
  };

  const handleQuickTrade = async () => {
    if (!activeLoanId) {
      showToast('Load a deal first to access trading', 'info');
      return;
    }
    setIsLoading('trade');
    onQuickTrade?.();
    router.push(`/trade-pack?loanId=${activeLoanId}&action=new`);
    setIsOpen(false);
    setIsLoading(null);
  };

  const handleAiScan = async () => {
    if (!activeLoanId) {
      showToast('Load a deal first to run AI analysis', 'info');
      return;
    }
    setIsLoading('scan');
    setIsOpen(false);
    try {
      const result = await runAgentWorkflow(activeLoanId);
      showToast(`AI Scan complete: ${result.recommendations_generated} recommendations generated`, 'success');
      onAiScan?.();
      
      // Navigate to DLR page and scroll to recommendations
      router.push('/dlr#ai-recommendations');
      
      // Wait for navigation then scroll
      setTimeout(() => {
        const recSection = document.getElementById('ai-recommendations');
        if (recSection) {
          recSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    } catch (e: any) {
      showToast(`Scan failed: ${e.message}`, 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleGenerateVideo = async () => {
    if (!activeLoanId) {
      showToast('Load a deal first to generate video', 'info');
      return;
    }
    setIsLoading('video');
    setIsOpen(false);
    try {
      const result = await generateVideoBriefing(activeLoanId, 'daily_update');
      if (result && result.script) {
        setVideoResult(result);
        // Use setTimeout to ensure state updates before showing modal
        setTimeout(() => {
          setShowVideoModal(true);
        }, 100);
        onVideoGenerated?.(result);
      } else {
        showToast(`Video generation failed: ${result?.error || 'No script generated'}`, 'error');
      }
    } catch (e: any) {
      showToast(`Video generation failed: ${e.message}`, 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const handleExportDocs = async () => {
    if (!activeLoanId) {
      showToast('Load a deal first to export documents', 'info');
      return;
    }
    setIsLoading('export');
    setIsOpen(false);
    
    // Trigger actual document export
    try {
      // Export DLR as JSON
      const dlrResponse = await fetch(`http://localhost:8007/api/loans/${activeLoanId}/dlr`);
      if (dlrResponse.ok) {
        const dlr = await dlrResponse.json();
        const blob = new Blob([JSON.stringify(dlr, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loan_${activeLoanId}_documents.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Documents exported successfully!', 'success');
      } else {
        throw new Error('Failed to fetch loan data');
      }
    } catch (e: any) {
      showToast(`Export failed: ${e.message}`, 'error');
    } finally {
      setIsLoading(null);
    }
  };

  const actions = [
    { 
      id: 'trade', 
      icon: Zap, 
      label: 'Quick Trade', 
      color: 'var(--accent-success)',
      onClick: handleQuickTrade 
    },
    { 
      id: 'scan', 
      icon: ScanSearch, 
      label: 'AI Scan', 
      color: 'var(--neon-purple)',
      onClick: handleAiScan 
    },
    { 
      id: 'video', 
      icon: Video, 
      label: 'Video Brief', 
      color: 'var(--accent-warning)',
      onClick: handleGenerateVideo 
    },
    { 
      id: 'export', 
      icon: FileText, 
      label: 'Export Docs', 
      color: 'var(--accent-secondary)',
      onClick: handleExportDocs 
    }
  ];

  const fabContent = (
    <div className="fab-container">
      {/* Action Menu */}
      <div className={`fab-menu ${isOpen ? 'open' : ''}`}>
        {actions.map(action => {
          const IconComponent = action.icon;
          return (
            <button
              key={action.id}
              className="fab-action"
              onClick={action.onClick}
              disabled={isLoading === action.id}
              style={{
                borderColor: isOpen ? action.color : undefined,
                opacity: isLoading && isLoading !== action.id ? 0.5 : 1
              }}
            >
              {isLoading === action.id ? (
                <span className="spinner" style={{ width: 16, height: 16 }} />
              ) : (
                <>
                  <IconComponent size={16} style={{ color: action.color }} />
                  <span>{action.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Main FAB Button */}
      <button
        className={`fab-main ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open quick actions'}
      >
        {isOpen ? <X size={28} /> : <Plus size={28} />}
      </button>
      
      {/* Active Deal Indicator */}
      {activeLoanId && !isOpen && (
        <div style={{
          position: 'absolute',
          bottom: 76,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--accent-success)',
          borderRadius: 'var(--radius-full)',
          padding: '6px 14px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--accent-success)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <CheckCircle size={12} />
          {loanName ? loanName.substring(0, 20) : `Deal #${activeLoanId}`} active
        </div>
      )}
      
      {/* Backdrop */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 4, 15, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: -1
          }}
          onClick={() => setIsOpen(false)}
        />
      )}

    </div>
  );

  // Video Modal rendered via portal to ensure it's on top
  const videoModal = showVideoModal && videoResult && mounted ? createPortal(
    <div 
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 4, 15, 0.9)',
        backdropFilter: 'blur(12px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl, 24px)'
      }}
      onClick={() => setShowVideoModal(false)}
    >
      <div 
        className="card"
        style={{
          maxWidth: 700,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--bg-card, #0d1a2d)',
          border: '1px solid var(--accent-warning, #f39c12)',
          boxShadow: '0 0 60px rgba(243, 156, 18, 0.3)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-lg" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ 
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(243, 156, 18, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Video size={24} style={{ color: '#f39c12' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'white' }}>Video Briefing Ready</h2>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.7, color: 'white' }}>
                {videoResult.video_type?.replace('_', ' ').toUpperCase() || 'DAILY UPDATE'} • {videoResult.duration_seconds || 45}s
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowVideoModal(false)}
            style={{ 
              background: 'transparent', 
              border: '1px solid rgba(255,255,255,0.2)', 
              borderRadius: 8, 
              padding: 8, 
              cursor: 'pointer',
              color: 'white'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Preview / Render Progress */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(243,156,18,0.1) 0%, rgba(0,20,40,1) 50%, rgba(0,212,170,0.1) 100%)',
          borderRadius: 12,
          aspectRatio: '16/9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          border: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {isRendering ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(243, 156, 18, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                position: 'relative'
              }}>
                <Loader2 size={40} color="#f39c12" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ 
                  position: 'absolute', 
                  fontSize: 14, 
                  fontWeight: 700, 
                  color: '#f39c12' 
                }}>{renderProgress}%</span>
              </div>
              <p style={{ fontWeight: 600, marginBottom: 4, color: 'white' }}>Rendering Video...</p>
              <p style={{ fontSize: 13, opacity: 0.7, color: 'white' }}>
                {renderStatus === 'rendering' ? 'AI avatar is reading your script' : renderStatus}
              </p>
              {/* Progress Bar */}
              <div style={{
                width: '80%',
                height: 6,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 3,
                margin: '16px auto 0',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${renderProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #f39c12, #00d4aa)',
                  borderRadius: 3,
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          ) : renderStatus === 'completed' && renderId ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: '#00d4aa',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 0 40px rgba(0,212,170,0.5)'
              }}>
                <CheckCircle size={40} color="#0A1628" />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 4, color: 'white' }}>Video Ready!</p>
              <p style={{ fontSize: 13, opacity: 0.7, color: 'white' }}>Render ID: {renderId}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(videoResult?.script || '');
                    showToast('Script copied!', 'success');
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid #00d4aa',
                    color: '#00d4aa',
                    padding: '10px 16px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <FileText size={16} /> Copy Script
                </button>
                <button
                  onClick={() => {
                    // Download actual video from backend
                    const downloadUrl = `http://localhost:8007/api/exports/download-video/${renderId}`;
                    window.open(downloadUrl, '_blank');
                    showToast('Video download started!', 'success');
                  }}
                  style={{
                    background: '#00d4aa',
                    border: 'none',
                    color: '#0A1628',
                    padding: '10px 16px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Download size={16} /> Download Video
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: '#f39c12',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 0 40px rgba(243,156,18,0.5)'
              }}>
                <Video size={36} color="#0A1628" />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 4, color: 'white' }}>AI Avatar Video</p>
              <p style={{ fontSize: 13, opacity: 0.7, color: 'white' }}>Script generated • Ready for rendering</p>
            </div>
          )}
        </div>

        {/* Avatar Selection */}
        {!isRendering && renderStatus !== 'completed' && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, color: 'white' }}>SELECT AVATAR</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { id: 'professional_female', name: 'Sarah', desc: 'Professional Female' },
                { id: 'professional_male', name: 'James', desc: 'Professional Male' },
                { id: 'casual', name: 'Alex', desc: 'Casual Style' }
              ].map(avatar => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    background: selectedAvatar === avatar.id ? 'rgba(243,156,18,0.2)' : 'rgba(255,255,255,0.05)',
                    border: selectedAvatar === avatar.id ? '2px solid #f39c12' : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <User size={24} style={{ 
                    margin: '0 auto 8px',
                    color: selectedAvatar === avatar.id ? '#f39c12' : 'rgba(255,255,255,0.5)'
                  }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'white' }}>{avatar.name}</p>
                  <p style={{ margin: 0, fontSize: 11, opacity: 0.6, color: 'white' }}>{avatar.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Script Preview */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, color: 'white' }}>GENERATED SCRIPT</h3>
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            padding: 16,
            borderRadius: 8,
            maxHeight: 150,
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            color: '#e0e0e0',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {videoResult.script || 'Script content will appear here...'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              background: renderStatus === 'completed' ? 'rgba(0,212,170,0.2)' : 'rgba(243,156,18,0.2)', 
              color: renderStatus === 'completed' ? '#00d4aa' : '#f39c12', 
              padding: '4px 10px', 
              borderRadius: 12, 
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {renderStatus === 'completed' ? <CheckCircle size={12} /> : <Video size={12} />}
              {renderStatus === 'completed' ? 'rendered' : videoResult.status || 'completed'}
            </span>
            <span style={{ fontSize: 12, opacity: 0.5, color: 'white' }}>
              Generated {new Date(videoResult.created_at || Date.now()).toLocaleTimeString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(videoResult.script || '');
                showToast('Script copied to clipboard', 'success');
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Copy Script
            </button>
            <button 
              onClick={async () => {
                if (isRendering) return;
                if (renderStatus === 'completed') {
                  // Reset for new render
                  setRenderStatus('idle');
                  setRenderProgress(0);
                  setRenderId(null);
                  return;
                }
                
                setIsRendering(true);
                setRenderProgress(0);
                setRenderStatus('starting');
                
                try {
                  // Start render
                  const result = await renderVideo(videoResult.job_id, {
                    avatarStyle: selectedAvatar,
                    background: 'office',
                    resolution: '1080p'
                  });
                  
                  setRenderId(result.render_id);
                  setRenderProgress(result.progress);
                  setRenderStatus('rendering');
                  
                  // Poll for status
                  renderPollRef.current = setInterval(async () => {
                    try {
                      const status = await getRenderStatus(result.render_id);
                      setRenderProgress(status.progress);
                      setRenderStatus(status.status);
                      
                      if (status.status === 'completed' || status.status === 'failed') {
                        clearInterval(renderPollRef.current!);
                        setIsRendering(false);
                        if (status.status === 'completed') {
                          showToast('Video rendered successfully!', 'success');
                        } else {
                          showToast('Video render failed', 'error');
                        }
                      }
                    } catch (e) {
                      console.error('Poll error:', e);
                    }
                  }, 1500);
                  
                } catch (e: any) {
                  setIsRendering(false);
                  setRenderStatus('failed');
                  showToast(`Render failed: ${e.message}`, 'error');
                }
              }}
              disabled={isRendering}
              style={{
                background: isRendering ? 'rgba(243,156,18,0.5)' : renderStatus === 'completed' ? '#00d4aa' : '#f39c12',
                border: 'none',
                color: '#0A1628',
                padding: '10px 16px',
                borderRadius: 8,
                cursor: isRendering ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {isRendering ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Rendering...
                </>
              ) : renderStatus === 'completed' ? (
                <>
                  <Play size={16} /> Render Again
                </>
              ) : (
                <>
                  <Play size={16} /> Render Video
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {fabContent}
      {videoModal}
    </>
  );
}
