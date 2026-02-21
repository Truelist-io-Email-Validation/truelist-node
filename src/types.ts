export type TruelistOptions = {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
};

export type ValidateOptions = {
  signal?: AbortSignal;
};

export type ValidationState = "ok" | "email_invalid" | "risky" | "unknown" | "accept_all";

export type ValidationSubState =
  | "email_ok"
  | "accept_all"
  | "is_disposable"
  | "is_role"
  | "failed_smtp_check"
  | "failed_mx_check"
  | "failed_spam_trap"
  | "failed_no_mailbox"
  | "failed_greylisted"
  | "failed_syntax_check"
  | "unknown_error";

export type ValidationResult = {
  email: string;
  domain: string;
  canonical: string;
  mxRecord: string | null;
  firstName: string | null;
  lastName: string | null;
  state: ValidationState;
  subState: ValidationSubState;
  verifiedAt: string;
  suggestion: string | null;
};

export type AccountInfo = {
  email: string;
  name: string;
  uuid: string;
  timeZone: string;
  isAdminRole: boolean;
  account: {
    name: string;
    paymentPlan: string;
  };
};

export type ApiValidationEmail = {
  address: string;
  domain: string;
  canonical: string;
  mx_record: string | null;
  first_name: string | null;
  last_name: string | null;
  email_state: ValidationState;
  email_sub_state: ValidationSubState;
  verified_at: string;
  did_you_mean: string | null;
};

export type ApiValidationResponse = {
  emails: ApiValidationEmail[];
};

export type ApiAccountResponse = {
  email: string;
  name: string;
  uuid: string;
  time_zone: string;
  is_admin_role: boolean;
  account: {
    name: string;
    payment_plan: string;
  };
};
