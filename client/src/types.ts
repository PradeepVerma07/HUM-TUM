export type Role = 'admin' | 'client';
export type User = { id: string; name: string; role: Role; clientId: string | null };
export type Client = { id: string; name: string; status: 'active' | 'archived'; createdAt: string };
export type JobStatus =
  'submitted' | 'under_review' | 'in_progress' | 'waiting_client' | 'revision_requested' | 'on_hold' | 'completed' | 'cancelled';
export type Job = {
  id: string;
  clientId: string;
  title: string;
  description: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  postedBy: string;
  assetLink: string;
  calculatedHours: number;
  teamOverrideHours: number | null;
  teamOverrideNote: string;
  status: JobStatus;
  datePosted: string;
  dateCompleted: string | null;
  updatedAt: string;
};
export type Settings = {
  categories: { name: string; baseHours: number }[];
  capacityPerCategory: number;
  bufferHoursPerExtraJob: number;
  startHour: number;
  endHour: number;
  workDays: number[];
};
export type TicketCategory =
  | 'Technical Issue'
  | 'Account Issue'
  | 'Job Posting Issue'
  | 'Candidate Issue'
  | 'Client Issue'
  | 'Billing Issue'
  | 'Feature Request'
  | 'General Support';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TicketStatus = 'Open' | 'In Progress' | 'Waiting for User' | 'Resolved' | 'Closed';
export type TicketAttachment = {
  id: string;
  ticketNumber: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  messageId: string | null;
  createdAt: string;
};
export type TicketMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
  attachments: TicketAttachment[];
};
export type SupportTicket = {
  ticketNumber: string;
  userId: string;
  userName: string;
  clientId: string | null;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};
export type SupportTicketDetail = SupportTicket & { messages: TicketMessage[]; attachments: TicketAttachment[] };
export type Bootstrap = {
  user: User;
  jobs: Job[];
  clients: Client[];
  supportTickets: SupportTicket[];
  settings: Settings;
  categoryLoad: Record<string, number>;
};
