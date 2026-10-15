# Backend configuration

## Email OTP signup

Signup verification sends a six-digit, single-use code to the submitted email.
Codes expire after 10 minutes, allow up to five attempts, and can be resent
after 60 seconds. Phone numbers are optional and are not verified.

Configure SMTP in `backend/.env`. For Gmail, use an app password rather than
your regular account password:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-sender@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM_EMAIL=your-sender@gmail.com
SMTP_USE_SSL=false
SMTP_STARTTLS=true
```

For an SMTP provider using implicit SSL (usually port 465), set
`SMTP_USE_SSL=true` and `SMTP_STARTTLS=false`. Never commit real SMTP credentials.

Apply database migrations after checkout:

```powershell
alembic upgrade head
```
