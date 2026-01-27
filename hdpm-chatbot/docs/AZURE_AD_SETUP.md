# Azure AD / Microsoft Entra ID Setup Guide

This guide walks you through setting up Microsoft authentication for the HDPM Chatbot, restricting access to `@highdesertpm.com` users only.

## Prerequisites

- Access to your organization's Microsoft Azure portal (portal.azure.com)
- Admin permissions to create App Registrations

## Step 1: Create an App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** (formerly Azure Active Directory)
3. Click **App registrations** in the left sidebar
4. Click **+ New registration**
5. Fill in the details:
   - **Name**: `HDPM Chatbot` (or your preferred name)
   - **Supported account types**: Select "Accounts in this organizational directory only (High Desert Property Management only - Single tenant)"
   - **Redirect URI**:
     - Platform: `Web`
     - URL: `http://localhost:3000/api/auth/callback/azure-ad` (for development)
6. Click **Register**

## Step 2: Get Your Application IDs

After registration, you'll see an overview page. Copy these values:

1. **Application (client) ID** → This is your `AZURE_AD_CLIENT_ID`
2. **Directory (tenant) ID** → This is your `AZURE_AD_TENANT_ID`

## Step 3: Create a Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **+ New client secret**
3. Add a description (e.g., "HDPM Chatbot Secret")
4. Choose an expiration (recommend 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the **Value** immediately (it won't be shown again)
   - This is your `AZURE_AD_CLIENT_SECRET`

## Step 4: Configure API Permissions

1. Go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
6. Click **Add permissions**
7. Click **Grant admin consent for High Desert Property Management**

## Step 5: Add Production Redirect URI (When Deploying)

When you deploy to production:

1. Go to **Authentication** in your app registration
2. Under **Platform configurations** → **Web**
3. Click **Add URI**
4. Add: `https://your-production-domain.com/api/auth/callback/azure-ad`

## Step 6: Configure Environment Variables

Add these to your `.env.local` file:

```env
# Generate a secret with: openssl rand -base64 32
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=http://localhost:3000

# Azure AD Configuration
AZURE_AD_CLIENT_ID=your-application-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret-value
AZURE_AD_TENANT_ID=your-directory-tenant-id
```

### Generating NEXTAUTH_SECRET

Run this command in your terminal:
```bash
openssl rand -base64 32
```

Copy the output and use it as your `NEXTAUTH_SECRET`.

## Step 7: Restart the Server

```bash
npm run dev
```

## Testing

1. Open http://localhost:3000
2. You should be redirected to the login page
3. Click "Sign in with Microsoft"
4. Sign in with your `@highdesertpm.com` account
5. You should be redirected back to the chatbot

## Troubleshooting

### "Access Denied" Error
- Make sure you're signing in with an `@highdesertpm.com` email
- The app is configured to reject all other domains

### "Invalid client" Error
- Double-check your `AZURE_AD_CLIENT_ID` is correct
- Make sure the app registration is in the correct Azure tenant

### "Redirect URI mismatch" Error
- Verify the redirect URI in Azure matches exactly:
  - Development: `http://localhost:3000/api/auth/callback/azure-ad`
  - Production: `https://your-domain.com/api/auth/callback/azure-ad`

### Session Expires Too Quickly
- Sessions are set to 8 hours by default (a work day)
- Adjust `maxAge` in `/app/api/auth/[...nextauth]/route.ts` if needed

## Security Notes

1. **Single Tenant**: The app only accepts users from your organization
2. **Domain Restriction**: Even within your tenant, only `@highdesertpm.com` emails are allowed
3. **API Protection**: The chat API also verifies the user's email domain
4. **Session Duration**: 8-hour sessions match a typical workday

## Production Checklist

Before deploying to production:

- [ ] Update `NEXTAUTH_URL` to your production URL
- [ ] Add production redirect URI to Azure App Registration
- [ ] Generate a new `NEXTAUTH_SECRET` for production
- [ ] Store secrets securely (e.g., in Vercel environment variables)
- [ ] Consider setting up token refresh for longer sessions
