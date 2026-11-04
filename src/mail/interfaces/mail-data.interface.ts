export interface MailData<T = never> {
  to: string;
  lang: string;
  data: T;
}
