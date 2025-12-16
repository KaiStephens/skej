export interface SkejEvent {
  id: number;
  title: string;
  start_time: string; // ISO 8601
  end_time: string;   // ISO 8601
  color: string;
  description?: string;
  is_done: boolean;
}

export type CreateEventInput = Omit<SkejEvent, 'id' | 'is_done'>;
export type UpdateEventInput = Partial<CreateEventInput> & { is_done?: boolean };
