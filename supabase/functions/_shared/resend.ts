const RESEND_URL = "https://api.resend.com/emails";

export type SendEmailInput = {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
};

export async function sendResendEmail(input: SendEmailInput): Promise<unknown> {
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${text}`);
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
