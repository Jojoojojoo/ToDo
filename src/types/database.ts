/** 與 Supabase 表對應的型別（Phase 1） */
export type DeadlineSource = 'manual' | 'document_extract';

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  line_notify_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  created_at: string;
}

export interface Deadline {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  description: string | null;
  source: DeadlineSource;
  document_extract_id: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithOwner extends Project {
  owner?: { id: string; email?: string } | null;
}

export interface DeadlineWithAssignee extends Deadline {
  assignee?: Profile | null;
}

/** Phase 2：通知紀錄 */
export type NotificationChannel = 'line' | 'email';

export interface NotificationLog {
  id: string;
  deadline_id: string;
  recipient: string;
  channel: NotificationChannel;
  sent_at: string;
  created_at: string;
}

/** Phase 3：AI 擷取之建議截止日（Edge Function 回傳） */
export interface SuggestedDeadline {
  title: string;
  due_date: string;
  description?: string | null;
  assignee_name?: string | null;
}

/** Phase 3：文件擷取批次紀錄 */
export interface DocumentExtract {
  id: string;
  project_id: string;
  file_name: string | null;
  extract_result: unknown;
  extracted_at: string;
  created_at: string;
  created_by: string | null;
}

/** Phase 4：專案通知規則（依專案／天數、管道） */
export interface NotificationRule {
  project_id: string;
  days_before: number;
  notify_line: boolean;
  notify_email: boolean;
  created_at: string;
  updated_at: string;
}
