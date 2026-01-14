'use client';
import { useState } from 'react';
import {
  Mail, Phone, MapPin, Clock, Send, MessageSquare,
  Building2, Globe, Linkedin, Twitter, HelpCircle,
  CheckCircle, User, Briefcase, FileText, AlertCircle,
  HeadphonesIcon, Calendar, Video, Sparkles
} from 'lucide-react';

interface ContactForm {
  name: string;
  email: string;
  company: string;
  phone: string;
  subject: string;
  category: string;
  message: string;
  priority: string;
}

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>({
    name: '',
    email: '',
    company: '',
    phone: '',
    subject: '',
    category: 'general',
    message: '',
    priority: 'normal'
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setSubmitted(true);
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (submitted) {
    return (
      <div className="flex-col gap-lg animate-stagger">
        <div className="card-premium text-center" style={{ padding: 'var(--space-3xl)' }}>
          <div
            className="mx-auto mb-lg flex items-center justify-center"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--accent-success-dim)'
            }}
          >
            <CheckCircle size={40} style={{ color: 'var(--accent-success)' }} />
          </div>
          <h1 className="h1 gradient-text-cyan mb-md">Message Sent!</h1>
          <p className="body opacity-70 mb-lg" style={{ maxWidth: 500, margin: '0 auto' }}>
            Thank you for reaching out. Our team will review your message and get back to you within 24 hours.
          </p>
          <div className="card" style={{ maxWidth: 400, margin: '0 auto', background: 'var(--bg-primary)' }}>
            <p className="small opacity-50 mb-sm">Reference Number</p>
            <p className="h3 font-mono" style={{ color: 'var(--accent-primary)' }}>
              LT-{Date.now().toString(36).toUpperCase()}
            </p>
          </div>
          <button
            className="btn primary mt-lg"
            onClick={() => { setSubmitted(false); setForm({ name: '', email: '', company: '', phone: '', subject: '', category: 'general', message: '', priority: 'normal' }); }}
          >
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col gap-lg animate-stagger">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="h1 gradient-text-cyan mb-xs">Contact Us</h1>
          <p className="body opacity-70">Get in touch with our team for support, sales, or partnership inquiries</p>
        </div>
      </div>

      {/* Quick Contact Options */}
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--accent-primary-dim) 100%)' }}>
        <div className="flex items-center gap-md mb-md">
          <div style={{ background: 'var(--accent-primary-dim)', padding: 12, borderRadius: 12 }}>
            <HelpCircle size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h3 className="font-semibold">Need Quick Answers?</h3>
            <p className="small opacity-50">Check our Help Center</p>
          </div>
        </div>
        <a href="/help" className="btn primary w-full">
          Visit Help Center
        </a>
      </div>

      <div className="grid gap-lg" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Contact Form */}
        <div className="card">
          <h2 className="h2 mb-lg flex items-center gap-sm">
            <MessageSquare size={24} style={{ color: 'var(--accent-primary)' }} />
            Send us a Message
          </h2>

          <form onSubmit={handleSubmit} className="space-y-md">
            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="small opacity-70 mb-xs block">Full Name *</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="John Smith"
                    className="input w-full pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="small opacity-70 mb-xs block">Email Address *</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="john@company.com"
                    className="input w-full pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="small opacity-70 mb-xs block">Company</label>
                <div className="relative">
                  <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="Company Name"
                    className="input w-full pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="small opacity-70 mb-xs block">Phone Number</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    className="input w-full pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="small opacity-70 mb-xs block">Category *</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="input w-full"
                  required
                >
                  <option value="general">General Inquiry</option>
                  <option value="sales">Sales & Pricing</option>
                  <option value="support">Technical Support</option>
                  <option value="partnership">Partnership</option>
                  <option value="demo">Request Demo</option>
                  <option value="feedback">Feedback</option>
                  <option value="bug">Report a Bug</option>
                </select>
              </div>
              <div>
                <label className="small opacity-70 mb-xs block">Priority</label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  className="input w-full"
                >
                  <option value="low">Low - General question</option>
                  <option value="normal">Normal - Standard request</option>
                  <option value="high">High - Time sensitive</option>
                  <option value="urgent">Urgent - Critical issue</option>
                </select>
              </div>
            </div>

            <div>
              <label className="small opacity-70 mb-xs block">Subject *</label>
              <input
                type="text"
                name="subject"
                value={form.subject}
                onChange={handleChange}
                required
                placeholder="Brief description of your inquiry"
                className="input w-full"
              />
            </div>

            <div>
              <label className="small opacity-70 mb-xs block">Message *</label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                required
                rows={5}
                placeholder="Please describe your inquiry in detail. Include any relevant information that will help us assist you better..."
                className="input w-full"
                style={{ resize: 'vertical', minHeight: 120 }}
              />
            </div>

            <div className="flex justify-between items-center pt-md">
              <p className="small opacity-50">
                * Required fields
              </p>
              <button
                type="submit"
                className="btn primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Contact Info Sidebar */}
        <div className="space-y-md">
          {/* Contact Details */}
          <div className="card">
            <h3 className="h3 mb-md">Get in Touch</h3>

            <div className="space-y-md">
              <div className="flex items-center gap-md">
                <div style={{ background: 'var(--accent-primary-dim)', padding: 10, borderRadius: 8 }}>
                  <Mail size={18} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div>
                  <p className="small opacity-50">Email</p>
                  <a href="mailto:support@loantwin.io" className="font-medium" style={{ color: 'var(--accent-primary)' }}>
                    support@loantwin.io
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-md">
                <div style={{ background: 'var(--accent-success-dim)', padding: 10, borderRadius: 8 }}>
                  <Clock size={18} style={{ color: 'var(--accent-success)' }} />
                </div>
                <div>
                  <p className="small opacity-50">Response Time</p>
                  <p className="font-medium">Within 24 hours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
