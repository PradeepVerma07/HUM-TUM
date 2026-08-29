import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Bootstrap, SupportTicket, SupportTicketDetail, TicketCategory, TicketPriority, TicketStatus } from './types';

const categories: TicketCategory[] = [
  'Technical Issue',
  'Account Issue',
  'Job Posting Issue',
  'Candidate Issue',
  'Client Issue',
  'Billing Issue',
  'Feature Request',
  'General Support',
];
const priorities: TicketPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const statuses: TicketStatus[] = ['Open', 'In Progress', 'Waiting for User', 'Resolved', 'Closed'];
const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'zip']);
const maxAttachmentBytes = 10 * 1024 * 1024;
const fmt = (value: string | Date) =>
  new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

type TicketForm = {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
};

function validateAttachment(file: File | null) {
  if (!file) return null;
  if (file.size > maxAttachmentBytes) throw new Error('Attachment must be 10 MB or smaller.');
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowedExtensions.has(extension)) throw new Error('Attachment must be PDF, DOC, DOCX, JPG, JPEG, PNG or ZIP.');
  return file;
}

export default function SupportTickets({ data, reload }: { data: Bootstrap; reload: () => Promise<void> }) {
  const isAdmin = data.user.role === 'admin';
  const tickets = useMemo(() => data.supportTickets || [], [data.supportTickets]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TicketForm>({ subject: '', category: 'Technical Issue', priority: 'Medium', description: '' });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState<SupportTicketDetail | null>(null);
  const [loadingTicket, setLoadingTicket] = useState('');
  const [reply, setReply] = useState('');
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const resetForm = () => {
    setForm({ subject: '', category: 'Technical Issue', priority: 'Medium', description: '' });
    setAttachment(null);
    setFormError('');
  };

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const file = validateAttachment(attachment);
      const result = await api.createSupportTicket({ ...form, attachment: file });
      resetForm();
      setShowForm(false);
      setToast(`Ticket ${result.ticket.ticketNumber} submitted successfully.`);
      await reload();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openTicket = async (ticketNumber: string) => {
    setLoadingTicket(ticketNumber);
    setDetailError('');
    try {
      const result = await api.getSupportTicket(ticketNumber);
      setSelected(result.ticket);
      setReply('');
    } catch (error: any) {
      setDetailError(error.message);
    } finally {
      setLoadingTicket('');
    }
  };

  const updateTicket = async (patch: Partial<Pick<SupportTicket, 'status' | 'priority'>>) => {
    if (!selected) return;
    setDetailError('');
    try {
      const result = await api.updateSupportTicket(selected.ticketNumber, patch);
      setSelected(result.ticket);
      setToast('Ticket updated.');
      await reload();
    } catch (error: any) {
      setDetailError(error.message);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setDetailError('');
    try {
      const result = await api.replySupportTicket(selected.ticketNumber, reply.trim());
      setSelected(result.ticket);
      setReply('');
      setToast('Reply sent.');
      await reload();
    } catch (error: any) {
      setDetailError(error.message);
    }
  };

  const downloadAttachment = async (ticketNumber: string, id: string, fileName: string) => {
    try {
      await api.downloadTicketAttachment(ticketNumber, id, fileName);
    } catch (error: any) {
      setDetailError(error.message);
    }
  };

  return (
    <section className="support-page">
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <div className="page-title">
        <div>
          <h2>{isAdmin ? 'Support Tickets' : 'My Support Tickets'}</h2>
          <p className="muted">
            {isAdmin
              ? 'Review, reply to, and manage every submitted ticket.'
              : 'Raise a ticket and track every support conversation in one place.'}
          </p>
        </div>
        <button type="button" className="primary" onClick={() => setShowForm(true)}>
          + Raise Ticket
        </button>
      </div>

      {detailError && <div className="alert error">{detailError}</div>}

      {tickets.length === 0 ? (
        <div className="card empty-state">
          <h3>No support tickets found.</h3>
          <button type="button" className="primary" onClick={() => setShowForm(true)}>
            Raise Your First Ticket
          </button>
        </div>
      ) : (
        <TicketTable tickets={tickets} isAdmin={isAdmin} loadingTicket={loadingTicket} onView={openTicket} />
      )}

      {showForm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="raise-ticket-title">
          <form className="modal-panel ticket-form" onSubmit={submitTicket}>
            <div className="modal-head">
              <div>
                <h2 id="raise-ticket-title">Raise Support Ticket</h2>
                <p className="muted">Share the issue details and the support team will follow up here.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close ticket form"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                x
              </button>
            </div>
            {formError && <div className="alert error">{formError}</div>}
            <label>
              Subject
              <input required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
            </label>
            <div className="row">
              <label>
                Category
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as TicketCategory })}>
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TicketPriority })}>
                  {priorities.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <label>
              Attachment
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                onChange={(event) => setAttachment(event.target.files?.[0] || null)}
              />
            </label>
            <p className="field-note">Allowed: PDF, DOC, DOCX, JPG, JPEG, PNG, ZIP. Maximum size: 10 MB.</p>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <TicketDetailModal
          ticket={selected}
          isAdmin={isAdmin}
          reply={reply}
          detailError={detailError}
          setReply={setReply}
          onClose={() => setSelected(null)}
          onReply={sendReply}
          onUpdate={updateTicket}
          onDownload={downloadAttachment}
        />
      )}
    </section>
  );
}

function TicketTable({
  tickets,
  isAdmin,
  loadingTicket,
  onView,
}: {
  tickets: SupportTicket[];
  isAdmin: boolean;
  loadingTicket: string;
  onView: (ticketNumber: string) => void;
}) {
  return (
    <div className="card table-card">
      <div className="responsive-table">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              {isAdmin && <th>User</th>}
              <th>Subject</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.ticketNumber}>
                <td>
                  <b>{ticket.ticketNumber}</b>
                </td>
                {isAdmin && <td>{ticket.userName}</td>}
                <td>{ticket.subject}</td>
                <td>{ticket.category}</td>
                <td>
                  <span className={`priority-badge priority-${slug(ticket.priority)}`}>{ticket.priority}</span>
                </td>
                <td>
                  <StatusBadge status={ticket.status} />
                </td>
                <td>{fmt(ticket.createdAt)}</td>
                <td>
                  <button type="button" className="small" onClick={() => onView(ticket.ticketNumber)}>
                    {loadingTicket === ticket.ticketNumber ? 'Opening...' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TicketDetailModal({
  ticket,
  isAdmin,
  reply,
  detailError,
  setReply,
  onClose,
  onReply,
  onUpdate,
  onDownload,
}: {
  ticket: SupportTicketDetail;
  isAdmin: boolean;
  reply: string;
  detailError: string;
  setReply: (value: string) => void;
  onClose: () => void;
  onReply: () => void;
  onUpdate: (patch: Partial<Pick<SupportTicket, 'status' | 'priority'>>) => void;
  onDownload: (ticketNumber: string, id: string, fileName: string) => void;
}) {
  const closed = ticket.status === 'Closed';
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title">
      <div className="modal-panel ticket-detail">
        <div className="modal-head">
          <div>
            <h2 id="ticket-detail-title">{ticket.ticketNumber}</h2>
            <p className="muted">{ticket.subject}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close ticket detail" onClick={onClose}>
            x
          </button>
        </div>
        {detailError && <div className="alert error">{detailError}</div>}
        <div className="ticket-meta">
          <div>
            <span>Category</span>
            <b>{ticket.category}</b>
          </div>
          <div>
            <span>Priority</span>
            <b>{ticket.priority}</b>
          </div>
          <div>
            <span>Status</span>
            <StatusBadge status={ticket.status} />
          </div>
          <div>
            <span>Created date</span>
            <b>{fmt(ticket.createdAt)}</b>
          </div>
          {isAdmin && (
            <div>
              <span>User</span>
              <b>{ticket.userName}</b>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="admin-ticket-controls">
            <label>
              Status
              <select value={ticket.status} onChange={(event) => onUpdate({ status: event.target.value as TicketStatus })}>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={ticket.priority} onChange={(event) => onUpdate({ priority: event.target.value as TicketPriority })}>
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <button type="button" className="danger" onClick={() => onUpdate({ status: 'Closed' })} disabled={closed}>
              Close Ticket
            </button>
          </div>
        )}

        <h3>Complete conversation</h3>
        <div className="conversation">
          {ticket.messages.map((message) => (
            <article className={`message ${message.authorRole}`} key={message.id}>
              <div className="message-head">
                <b>{message.authorName}</b>
                <span>
                  {message.authorRole === 'admin' ? 'Admin reply' : 'User reply'} - {fmt(message.createdAt)}
                </span>
              </div>
              <p>{message.body}</p>
              {message.attachments.length > 0 && (
                <div className="attachment-list">
                  {message.attachments.map((attachment) => (
                    <button
                      type="button"
                      className="attachment-chip"
                      key={attachment.id}
                      onClick={() => onDownload(ticket.ticketNumber, attachment.id, attachment.fileName)}
                    >
                      {attachment.fileName}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>

        {ticket.attachments.length > 0 && (
          <>
            <h3>Attachments</h3>
            <div className="attachment-list">
              {ticket.attachments.map((attachment) => (
                <button
                  type="button"
                  className="attachment-chip"
                  key={attachment.id}
                  onClick={() => onDownload(ticket.ticketNumber, attachment.id, attachment.fileName)}
                >
                  {attachment.fileName}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="reply-box">
          {closed ? (
            <div className="alert">This ticket has been closed.</div>
          ) : (
            <>
              <label>
                Reply box
                <textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write your reply..." />
              </label>
              <button type="button" className="primary" onClick={onReply} disabled={!reply.trim()}>
                Send Reply
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`status-badge status-${slug(status)}`}>{status}</span>;
}
