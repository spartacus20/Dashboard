export interface RetellCall {
  call_id: string;
  llm_id?: string;
  voice_id?: string;
  voice_name?: string;
  duration?: number;
  start_time?: string;
  end_time?: string;
  disconnection_reason?: string;
  status?: string;
  call_status?: string;
  call_type?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  transcript?: string;
  transcript_object?: TranscriptEntry[];
  recording_url?: string;
  public_log_url?: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  latency?: {
    e2e?: LatencyStats;
    llm?: LatencyStats;
    tts?: LatencyStats;
    s2s?: LatencyStats;
    knowledge_base?: LatencyStats;
    llm_websocket_network_rtt?: LatencyStats;
  };
  call_analysis?: CallAnalysis;
  call_cost?: CallCost;
  agent_id?: string;
  metadata?: Record<string, any>;
}

export type DetailedRetellCall = RetellCall;

export interface TranscriptEntry {
  timestamp: number;
  speaker: 'assistant' | 'user';
  text: string;
}

export interface LatencyStats {
  mean?: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

export interface CallAnalysis {
  sentiment?: string;
  topics?: string[];
  call_summary?: string;
  user_sentiment?: string;
  call_successful?: boolean;
  custom_analysis_data?: Record<string, any>;
  in_voicemail?: boolean;
}

export interface CallCost {
  total_cost?: number;
  llm_cost?: number;
  tts_cost?: number;
}

export interface ListCallsResponse {
  calls: RetellCall[];
  pagination_key?: string;
}

export interface FilterCriteria {
  start_timestamp?: {
    lower_threshold?: number;
    upper_threshold?: number;
  };
  duration_range?: {
    min?: number;
    max?: number;
  };
  disconnection_reason?: string;
  date_range?: {
    start?: string;
    end?: string;
  };
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface CallStats {
  total: number;
  completed: number;
  failed: number;
  averageDuration: string;
  averageDurationSeconds: number;
}

export interface RetellPhoneNumber {
  phone_number: string;
  phone_number_type: string;
  phone_number_pretty: string;
  inbound_agent_id: string;
  outbound_agent_id: string;
  area_code: number;
  nickname?: string;
  inbound_webhook_url?: string;
  last_modification_timestamp: number;
}

export interface RetellAgent {
  agent_id: string;
  agent_name: string;
  response_engine?: {
    type: string;
    llm_id?: string;
  };
  voice_id?: string;
  voice_model?: string;
  fallback_voice_ids?: string[];
  voice_temperature?: number;
  voice_speed?: number;
  volume?: number;
  responsiveness?: number;
  interruption_sensitivity?: number;
  enable_backchannel?: boolean;
  backchannel_frequency?: number;
  backchannel_words?: string[];
  reminder_trigger_ms?: number;
  reminder_max_count?: number;
  ambient_sound?: string;
  ambient_sound_volume?: number;
  language?: string;
  webhook_url?: string;
  boosted_keywords?: string[];
  enable_transcription_formatting?: boolean;
  opt_out_sensitive_data_storage?: boolean;
  pronunciation_dictionary?: Array<{
    word: string;
    alphabet: string;
    phoneme: string;
  }>;
  normalize_for_speech?: boolean;
  end_call_after_silence_ms?: number;
  max_call_duration_ms?: number;
  enable_voicemail_detection?: boolean;
  voicemail_message?: string;
  voicemail_detection_timeout_ms?: number;
  post_call_analysis_data?: Array<{
    type: string;
    name: string;
    description: string;
    examples: string[];
  }>;
  post_call_analysis_model?: string;
  begin_message_delay_ms?: number;
  ring_duration_ms?: number;
  stt_mode?: string;
  last_modification_timestamp: number;
}

export interface RetellBatchCall {
  batch_call_id: string;
  name: string;
  from_number: string;
  status: string;
  timezone: string;
  send_now: boolean;
  scheduled_timestamp: number;
  total: number;
  total_task_count: number;
  sent: number;
  picked_up: number;
  completed: number;
  last_sent_timestamp: number;
  tasks_url: string;
}

export interface BatchCallTask {
  id?: string; 
  phone_number: string;
  status: string;
  call_id?: string;
  retell_llm_dynamic_variables?: Record<string, any>;
  error_message?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  [key: string]: any; // Para campos adicionales que puedan existir
}

export interface ClientData {
  id: number;
  email: string;
  client_id: string;
  api_key: string;
  full_name?: string;
  created_at?: string;
  updated_at?: string;
}