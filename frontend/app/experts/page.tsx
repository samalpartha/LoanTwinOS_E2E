'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, MapPin, Star, Building2, Scale, Shield, Leaf,
  Search, Filter, Phone, Mail, Award, CheckCircle, Clock,
  AlertTriangle, FileText, Sparkles, Globe, ChevronRight,
  Navigation, ExternalLink, Loader2
} from 'lucide-react';
import {
  listExperts, seedDemoExperts, listExpertIssues, triageIssue,
  searchRealExperts, getMapConfig, getPlaceDetails
} from '../../lib/api';

const CATEGORY_ICONS: Record<string, any> = {
  legal: Scale,
  compliance: Shield,
  valuer: Building2,
  auditor: FileText,
  esg: Leaf,
  tax: FileText,
  restructuring: Building2
};

const CATEGORY_COLORS: Record<string, string> = {
  legal: 'var(--accent-primary)',
  compliance: 'var(--accent-warning)',
  valuer: 'var(--accent-secondary)',
  auditor: 'var(--accent-info)',
  esg: 'var(--accent-success)',
  tax: 'var(--accent-danger)',
  restructuring: 'var(--accent-warning)'
};

interface GoogleMapProps {
  apiKey: string;
  center: { lat: number; lng: number };
  zoom: number;
  experts: any[];
  onMarkerClick?: (expert: any) => void;
}

// Track if Google Maps script is already loading/loaded globally
let googleMapsLoading = false;
let googleMapsLoaded = false;
const googleMapsCallbacks: (() => void)[] = [];

function loadGoogleMapsScript(apiKey: string, callback: () => void) {
  // Check if Maps API is fully ready (not just window.google)
  if (googleMapsLoaded && typeof window !== 'undefined' && window.google?.maps?.Map) {
    callback();
    return;
  }

  googleMapsCallbacks.push(callback);

  if (googleMapsLoading) return;
  googleMapsLoading = true;

  // Check if script already exists
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript) {
    // Wait for it to load
    const checkReady = setInterval(() => {
      if (window.google?.maps?.Map) {
        clearInterval(checkReady);
        googleMapsLoaded = true;
        googleMapsLoading = false;
        googleMapsCallbacks.forEach(cb => cb());
        googleMapsCallbacks.length = 0;
      }
    }, 100);
    return;
  }

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__googleMapsCallback`;
  script.async = true;
  script.defer = true;

  // Use callback parameter for proper async loading
  (window as any).__googleMapsCallback = () => {
    googleMapsLoaded = true;
    googleMapsLoading = false;
    googleMapsCallbacks.forEach(cb => cb());
    googleMapsCallbacks.length = 0;
    delete (window as any).__googleMapsCallback;
  };

  document.head.appendChild(script);
}

// Google Maps Component
function GoogleMapComponent({ apiKey, center, zoom, experts, onMarkerClick }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load Google Maps script (only once)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    loadGoogleMapsScript(apiKey, () => setMapLoaded(true));
  }, [apiKey]);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google?.maps?.Map) return;

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ]
    });
  }, [mapLoaded, center, zoom]);

  // Update markers when experts change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps?.Marker) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    experts.forEach((expert, index) => {
      if (!expert.latitude || !expert.longitude) return;

      const marker = new google.maps.Marker({
        position: { lat: expert.latitude, lng: expert.longitude },
        map: mapInstanceRef.current,
        title: expert.full_name || expert.firm_name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: expert.source === 'google_places' ? '#00D8FF' : '#FFB800',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      marker.addListener('click', () => {
        if (onMarkerClick) onMarkerClick(expert);
      });

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #1a1a2e; padding: 8px; min-width: 200px;">
            <strong style="font-size: 14px;">${expert.full_name || expert.firm_name}</strong>
            <br/><span style="color: #666; font-size: 12px;">${expert.formatted_address || expert.city || ''}</span>
            ${expert.rating ? `<br/><span style="color: #FFB800;">★ ${expert.rating}</span>` : ''}
            ${expert.source === 'google_places' ? '<br/><span style="color: #00D8FF; font-size: 11px;">✓ Google Verified</span>' : ''}
          </div>
        `
      });

      marker.addListener('mouseover', () => infoWindow.open(mapInstanceRef.current, marker));
      marker.addListener('mouseout', () => infoWindow.close());

      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (markersRef.current.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markersRef.current.forEach(marker => {
        const pos = marker.getPosition();
        if (pos) bounds.extend(pos);
      });
      mapInstanceRef.current?.fitBounds(bounds);
    }
  }, [experts, onMarkerClick]);

  if (!mapLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full rounded-lg" />;
}

export default function ExpertNetworkPage() {
  const [experts, setExperts] = useState<any[]>([]);
  const [realTimeExperts, setRealTimeExperts] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchingRealTime, setSearchingRealTime] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExpert, setSelectedExpert] = useState<any>(null);
  const [mapConfig, setMapConfig] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });

  // Zip code search state
  const [zipCode, setZipCode] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [searchLocation, setSearchLocation] = useState<any>(null);

  useEffect(() => {
    loadData();
    loadMapConfig();
  }, [selectedCategory]);

  const loadMapConfig = async () => {
    try {
      const config = await getMapConfig();
      setMapConfig(config);
    } catch (e) {
      console.error('Failed to load map config:', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load experts (required)
      const expertsRes = await listExperts({ category: selectedCategory || undefined, limit: 50 });
      setExperts(expertsRes.experts || []);

      // Load issues (optional - may fail without auth)
      try {
        const issuesRes = await listExpertIssues({ status: 'open' });
        setIssues(issuesRes.issues || []);
      } catch {
        // Issues require auth - silently ignore for demo
        setIssues([]);
      }
    } catch (e) {
      console.error('Failed to load experts:', e);
    }
    setLoading(false);
  };

  const handleSeedDemoExperts = async () => {
    try {
      await seedDemoExperts();
      loadData();
    } catch (e) {
      console.error('Failed to seed demo experts:', e);
    }
  };

  const handleRealTimeSearch = async () => {
    if (!zipCode || !issueDescription) return;

    setSearchingRealTime(true);
    try {
      const result = await searchRealExperts({
        zip_code: zipCode,
        expert_type: selectedCategory || 'legal',
        issue_description: issueDescription,
        radius_miles: 50
      });

      setRealTimeExperts(result.experts || []);
      setSearchLocation(result.search_location);

      if (result.search_location?.latitude && result.search_location?.longitude) {
        setMapCenter({
          lat: result.search_location.latitude,
          lng: result.search_location.longitude
        });
      }
    } catch (e) {
      console.error('Real-time search failed:', e);
    }
    setSearchingRealTime(false);
  };

  // When real-time results exist, show them first/only; otherwise show database experts
  // Real-time results take priority as they are location-specific
  const displayExperts = realTimeExperts.length > 0
    ? realTimeExperts  // Only show real-time results when available
    : experts;         // Otherwise show demo/database experts

  const filteredExperts = displayExperts.filter(e =>
    searchQuery === '' ||
    e.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.firm_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['legal', 'compliance', 'tax', 'valuer', 'esg', 'restructuring'];

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="h1 gradient-text-cyan mb-xs">Expert Network</h1>
          <p className="body opacity-70">AI-powered legal & compliance expert matching with Google Maps</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn secondary" onClick={handleSeedDemoExperts}>
            <Sparkles size={16} /> Load Demo Experts
          </button>
        </div>
      </div>

      {/* Real-Time Search Card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--accent-primary-dim) 100%)' }}>
        <div className="flex items-center gap-sm mb-md">
          <Navigation size={20} style={{ color: 'var(--accent-primary)' }} />
          <h3 className="h3">Real-Time Expert Search</h3>
          <span className="badge" style={{ background: 'rgba(0, 0, 0, 0.6)', color: '#FFFFFF', border: '1px solid var(--border-default)' }}>
            Google Maps + Groq AI
          </span>
        </div>

        <div className="grid grid-cols-4 gap-md">
          <div>
            <label className="small opacity-70 mb-xs block">Zip Code</label>
            <input
              type="text"
              placeholder="e.g., 10001"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="w-full px-md py-sm rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="small opacity-70 mb-xs block">Expert Type</label>
            <select
              value={selectedCategory || 'legal'}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-md py-sm rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="small opacity-70 mb-xs block">Issue Description</label>
            <input
              type="text"
              placeholder="Describe your legal/compliance issue..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              className="w-full px-md py-sm rounded-lg"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-md mt-md">
          <button
            className="btn primary"
            onClick={handleRealTimeSearch}
            disabled={!zipCode || !issueDescription || searchingRealTime}
          >
            {searchingRealTime ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Searching...
              </>
            ) : (
              <>
                <Search size={16} /> Find Real Experts
              </>
            )}
          </button>

          <button
            className="btn secondary"
            onClick={() => {
              setZipCode('10001');
              setIssueDescription('LMA syndicated loan compliance');
              // Auto-trigger search after state updates
              setTimeout(async () => {
                setSearchingRealTime(true);
                try {
                  const result = await searchRealExperts({
                    zip_code: '10001',
                    expert_type: selectedCategory || 'legal',
                    issue_description: 'LMA syndicated loan compliance',
                    radius_miles: 50
                  });
                  setRealTimeExperts(result.experts || []);
                  setSearchLocation(result.search_location);
                  if (result.search_location?.latitude && result.search_location?.longitude) {
                    setMapCenter({
                      lat: result.search_location.latitude,
                      lng: result.search_location.longitude
                    });
                  }
                } catch (e) {
                  console.error('Real-time search failed:', e);
                }
                setSearchingRealTime(false);
              }, 100);
            }}
            disabled={searchingRealTime}
          >
            <MapPin size={16} /> Quick Search: NYC
          </button>

          {searchLocation && (
            <div className="flex items-center gap-sm text-sm">
              <MapPin size={16} style={{ color: 'var(--accent-success)' }} />
              <span className="opacity-70">
                Found location: <strong>{searchLocation.formatted_address}</strong>
              </span>
              <span className="badge small" style={{ background: `var(--accent-${searchLocation.source === 'google' ? 'primary' : 'secondary'}-dim)` }}>
                via {searchLocation.source}
              </span>
            </div>
          )}
        </div>

        {realTimeExperts.length > 0 && (
          <div className="mt-md p-md rounded-lg" style={{ background: 'var(--accent-success-dim)', border: '1px solid var(--accent-success)' }}>
            <div className="flex items-center justify-between mb-sm">
              <span className="font-semibold" style={{ color: 'var(--accent-success)' }}>
                ✓ {realTimeExperts.length} Real Experts Found Near {searchLocation?.city || zipCode}
              </span>
              <div className="flex gap-sm">
                <span className="badge small" style={{ background: 'var(--accent-primary-dim)' }}>
                  {realTimeExperts.filter(e => e.source === 'google_places').length} Google Verified
                </span>
                <span className="badge small" style={{ background: 'var(--accent-warning-dim)' }}>
                  {realTimeExperts.filter(e => e.source === 'groq_ai').length} AI Suggested
                </span>
              </div>
            </div>
            <p className="small opacity-70">Scroll down to see real experts fetched for your location. These replace any demo data.</p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-md">
        {categories.map(cat => {
          const Icon = CATEGORY_ICONS[cat];
          const count = displayExperts.filter(e => e.category === cat).length;
          return (
            <div
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`card interactive-hover cursor-pointer ${selectedCategory === cat ? 'ring-2' : ''}`}
              style={{
                borderColor: selectedCategory === cat ? CATEGORY_COLORS[cat] : undefined,
                '--ring-color': CATEGORY_COLORS[cat]
              } as any}
            >
              <div className="flex items-center gap-sm mb-sm">
                <div className="p-xs rounded-lg" style={{ background: `${CATEGORY_COLORS[cat]}20` }}>
                  <Icon size={16} style={{ color: CATEGORY_COLORS[cat] }} />
                </div>
                <span className="small font-semibold capitalize">{cat}</span>
              </div>
              <div className="h3" style={{ color: CATEGORY_COLORS[cat] }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Main Content - Map + List */}
      <div className="grid gap-lg" style={{ gridTemplateColumns: '1fr 400px' }}>
        {/* Google Map */}
        <div className="card" style={{ height: 500, padding: 0, overflow: 'hidden' }}>
          {mapConfig?.api_key ? (
            <GoogleMapComponent
              apiKey={mapConfig.api_key}
              center={mapCenter}
              zoom={12}
              experts={filteredExperts.filter(e => e.latitude && e.longitude)}
              onMarkerClick={(expert) => setSelectedExpert(expert)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-center">
                <Globe size={48} className="mx-auto mb-md opacity-30" />
                <p className="small opacity-50">Loading map...</p>
              </div>
            </div>
          )}
        </div>

        {/* Expert List / Detail */}
        <div className="space-y-md" style={{ maxHeight: 500, overflowY: 'auto' }}>
          {selectedExpert ? (
            <div className="card">
              <div className="flex justify-between items-start mb-md">
                <h3 className="h3">Expert Details</h3>
                <button className="btn-icon small" onClick={() => setSelectedExpert(null)}>×</button>
              </div>

              <div className="text-center mb-md pb-md" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-sm flex items-center justify-center"
                  style={{ background: `${CATEGORY_COLORS[selectedExpert.category || 'legal']}20` }}
                >
                  {(() => {
                    const Icon = CATEGORY_ICONS[selectedExpert.category || 'legal'] || Users;
                    return <Icon size={28} style={{ color: CATEGORY_COLORS[selectedExpert.category || 'legal'] }} />;
                  })()}
                </div>
                <h4 className="font-semibold">{selectedExpert.full_name || selectedExpert.firm_name}</h4>
                {selectedExpert.firm_name && selectedExpert.full_name !== selectedExpert.firm_name && (
                  <div className="small opacity-70">{selectedExpert.firm_name}</div>
                )}

                <div className="flex items-center justify-center gap-sm mt-sm">
                  {selectedExpert.source === 'google_places' ? (
                    <span className="badge small" style={{ background: 'var(--accent-primary-dim)' }}>
                      <CheckCircle size={12} /> Google Verified
                    </span>
                  ) : selectedExpert.source === 'groq_ai' ? (
                    <span className="badge small" style={{ background: 'var(--accent-warning-dim)' }}>
                      <Sparkles size={12} /> AI Suggested
                    </span>
                  ) : selectedExpert.verified ? (
                    <span className="badge small" style={{ background: 'var(--accent-success-dim)' }}>
                      <CheckCircle size={12} /> Verified
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-sm">
                {selectedExpert.formatted_address && (
                  <div className="flex items-start gap-sm">
                    <MapPin size={16} className="opacity-50 mt-xs" />
                    <span className="small">{selectedExpert.formatted_address}</span>
                  </div>
                )}
                {selectedExpert.city && !selectedExpert.formatted_address && (
                  <div className="flex items-center gap-sm">
                    <MapPin size={16} className="opacity-50" />
                    <span className="small">{selectedExpert.city}, {selectedExpert.state || selectedExpert.country}</span>
                  </div>
                )}
                {selectedExpert.rating && (
                  <div className="flex items-center gap-sm">
                    <Star size={16} style={{ color: 'var(--accent-warning)' }} />
                    <span className="small">
                      {selectedExpert.rating}
                      {selectedExpert.total_ratings && ` (${selectedExpert.total_ratings} reviews)`}
                    </span>
                  </div>
                )}
                {selectedExpert.email && (
                  <div className="flex items-center gap-sm">
                    <Mail size={16} className="opacity-50" />
                    <span className="small">{selectedExpert.email}</span>
                  </div>
                )}
                {selectedExpert.phone && (
                  <div className="flex items-center gap-sm">
                    <Phone size={16} className="opacity-50" />
                    <span className="small">{selectedExpert.phone}</span>
                  </div>
                )}
                {(selectedExpert.estimated_rate_min || selectedExpert.hourly_rate) && (
                  <div className="flex items-center gap-sm">
                    <span className="small opacity-50">Rate:</span>
                    <span className="small font-semibold" style={{ color: 'var(--accent-secondary)' }}>
                      {selectedExpert.estimated_rate_min ?
                        `$${selectedExpert.estimated_rate_min} - $${selectedExpert.estimated_rate_max}/hr` :
                        `${selectedExpert.currency || '$'}${selectedExpert.hourly_rate}/hr`
                      }
                    </span>
                  </div>
                )}
                {selectedExpert.match_reason && (
                  <div className="p-sm rounded-lg mt-md" style={{ background: 'var(--bg-primary)' }}>
                    <div className="small opacity-70 mb-xs">Why this expert?</div>
                    <div className="small">{selectedExpert.match_reason}</div>
                  </div>
                )}
                {selectedExpert.specialties && selectedExpert.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-xs mt-md">
                    {selectedExpert.specialties.map((s: string, i: number) => (
                      <span key={i} className="badge small">{s}</span>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="btn primary w-full mt-md"
                onClick={() => setSelectedExpert(null)}
              >
                <ChevronRight size={16} /> Back to List
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h3 className="h3">
                  {realTimeExperts.length > 0
                    ? `Experts Near ${searchLocation?.city || zipCode}`
                    : selectedCategory
                      ? `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Experts`
                      : 'All Experts'}
                </h3>
                <span className="small opacity-50">
                  {filteredExperts.length} found
                  {realTimeExperts.length > 0 && <span style={{ color: 'var(--accent-success)' }}> (Real-time)</span>}
                </span>
              </div>

              {loading ? (
                <div className="card p-lg text-center">
                  <Loader2 size={32} className="mx-auto mb-md animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  <p className="small opacity-50">Loading experts...</p>
                </div>
              ) : filteredExperts.length === 0 ? (
                <div className="card p-lg text-center">
                  <Users size={48} className="mx-auto mb-md opacity-30" />
                  <h4 className="font-semibold mb-sm">No Experts Found</h4>
                  <p className="small opacity-50 mb-md">Search by zip code above or load demo data</p>
                  <button className="btn primary" onClick={handleSeedDemoExperts}>
                    <Sparkles size={16} /> Load Demo Experts
                  </button>
                </div>
              ) : (
                <div className="space-y-sm">
                  {filteredExperts.slice(0, 15).map((expert, idx) => {
                    const Icon = CATEGORY_ICONS[expert.category] || Users;
                    return (
                      <div
                        key={expert.id || idx}
                        className="card interactive-hover cursor-pointer p-md"
                        onClick={() => setSelectedExpert(expert)}
                      >
                        <div className="flex items-center gap-md">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: `${CATEGORY_COLORS[expert.category || 'legal']}20` }}
                          >
                            <Icon size={18} style={{ color: CATEGORY_COLORS[expert.category || 'legal'] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-sm">
                              <span className="font-semibold truncate">{expert.full_name || expert.firm_name}</span>
                              {expert.source === 'google_places' && (
                                <CheckCircle size={12} style={{ color: 'var(--accent-primary)' }} />
                              )}
                              {expert.source === 'groq_ai' && (
                                <Sparkles size={12} style={{ color: 'var(--accent-warning)' }} />
                              )}
                            </div>
                            <div className="small opacity-50 truncate">
                              {expert.city || expert.formatted_address?.split(',')[0]}
                            </div>
                          </div>
                          {expert.rating && (
                            <div className="flex items-center gap-xs">
                              <Star size={12} style={{ color: 'var(--accent-warning)' }} />
                              <span className="small">{expert.rating}</span>
                            </div>
                          )}
                          <ChevronRight size={16} className="opacity-30" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// TypeScript declaration for Google Maps
declare global {
  interface Window {
    google: typeof google;
  }
}
