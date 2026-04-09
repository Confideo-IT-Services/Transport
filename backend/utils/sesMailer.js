const nodemailer = require('nodemailer');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

function getSesRegion() {
  return (process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-south-1').trim();
}

function getSesApiCredentials() {
  const accessKeyId = (process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  const sessionToken = (process.env.AWS_SES_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN || '').trim();
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey, sessionToken: sessionToken || undefined };
}

function shouldUseSesApi() {
  const flag = String(process.env.AWS_SES_USE_API || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return Boolean(getSesApiCredentials());
}

function getSesClient() {
  return new SESClient({
    region: getSesRegion(),
    credentials: getSesApiCredentials() || undefined,
  });
}

function getSmtpHost() {
  return (process.env.AWS_SES_SMTP_HOST || `email-smtp.${getSesRegion()}.amazonaws.com`).trim();
}

function getSmtpPort() {
  const raw = (process.env.AWS_SES_SMTP_PORT || '').trim();
  const n = raw ? parseInt(raw, 10) : 587;
  return Number.isFinite(n) && n > 0 ? n : 587;
}

function getSmtpSecure() {
  const raw = String(process.env.AWS_SES_SMTP_SECURE || '').trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  // Default: STARTTLS on 587
  return false;
}

function getSmtpAuth() {
  const user = (process.env.AWS_SES_SMTP_USERNAME || '').trim();
  const pass = (process.env.AWS_SES_SMTP_PASSWORD || '').trim();
  if (!user || !pass) {
    throw new Error('AWS_SES_SMTP_USERNAME/AWS_SES_SMTP_PASSWORD are not set');
  }
  return { user, pass };
}

function getTransporter() {
  return nodemailer.createTransport({
    host: getSmtpHost(),
    port: getSmtpPort(),
    secure: getSmtpSecure(),
    auth: getSmtpAuth(),
  });
}

function getFromAddress() {
  return (process.env.AWS_SES_FROM_EMAIL || '').trim();
}

function getFromName() {
  return (process.env.AWS_SES_FROM_NAME || '').trim();
}

function formatFromHeader(email, name) {
  if (!name) return email;
  // Very small sanitization to avoid breaking headers.
  const safeName = name.replace(/[\r\n"]/g, '').trim();
  return safeName ? `"${safeName}" <${email}>` : email;
}

async function sendTransportEmail(toEmail, { subject, textBody, htmlBody }) {
  const fromEmail = getFromAddress();
  if (!fromEmail) {
    throw new Error('AWS_SES_FROM_EMAIL is not set');
  }
  const to = String(toEmail || '').trim();
  if (!to) {
    throw new Error('toEmail is required');
  }

  // Prefer SES API (IAM credentials) because SMTP often fails with 535 in misconfigured accounts.
  if (shouldUseSesApi()) {
    const client = getSesClient();
    const cmd = new SendEmailCommand({
      Source: formatFromHeader(fromEmail, getFromName()),
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: String(subject || ''), Charset: 'UTF-8' },
        Body: {
          ...(textBody ? { Text: { Data: String(textBody), Charset: 'UTF-8' } } : null),
          ...(htmlBody ? { Html: { Data: String(htmlBody), Charset: 'UTF-8' } } : null),
        },
      },
    });
    return await client.send(cmd);
  }

  const transporter = getTransporter();
  return await transporter.sendMail({
    from: formatFromHeader(fromEmail, getFromName()),
    to,
    subject: String(subject || ''),
    text: textBody ? String(textBody) : undefined,
    html: htmlBody ? String(htmlBody) : undefined,
  });
}

module.exports = {
  sendTransportEmail,
  getSesRegion,
};

