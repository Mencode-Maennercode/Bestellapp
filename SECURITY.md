# Security Implementation

## Overview
This application now uses a code-based authentication system to protect all administrative routes. Guests can only access table-specific pages via their unique QR codes.

## Protected Routes

All administrative routes now require a unique access code in the URL:

### Counter/Bar Routes
- **Main Counter**: `https://***.vercel.app/bar/V26K`
- **Counter 1**: `https://***.vercel.app/bar1/V26K`
- **Counter 2**: `https://***.vercel.app/bar2/V26K`

### Waiter Route
- **Waiter View**: `https://***.vercel.app/kellner/V26K`

### Admin Routes
- **Settings**: `https://***.vercel.app/settings/V26K`
- **Products**: `https://***.vercel.app/produkte/V26K`
- **QR Codes**: `https://***.vercel.app/qrcodes/V26K`

### Guest Routes (Unchanged)
- **Table Access**: `https://***.vercel.app/tische/[unique-table-code]`
  - Each table has its own unique code
  - These remain unchanged and work as before

## Blocked Routes

The following routes are now blocked and will show an "Access Denied" message:

- `https://***.vercel.app/` (root page)
- `https://***.vercel.app/bar` (without code)
- `https://***.vercel.app/kellner` (without code)
- `https://***.vercel.app/settings` (without code)
- `https://***.vercel.app/produkte` (without code)
- `https://***.vercel.app/qrcodes` (without code)

## Configuration

### Changing the Admin Code

The admin access code is stored in the environment variable `NEXT_PUBLIC_ADMIN_CODE`.

**Default code**: `V26K`

To change the code:

1. Create or edit `.env.local` file in the project root
2. Add or update the line:
   ```
   NEXT_PUBLIC_ADMIN_CODE=YourNewUniqueCode
   ```
3. Restart your development server or redeploy

**Important**: 
- Choose a unique, hard-to-guess code
- Do not share this code publicly
- Change it if you suspect it has been compromised
- The code is case-sensitive

### Example `.env.local` file

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.europe-west1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Admin Access Code (change this to a unique random code)
NEXT_PUBLIC_ADMIN_CODE=V26K
```

## Security Features

1. **No Default Admin Access**: The root URL and unprotected routes are completely blocked
2. **Code-Based Authentication**: All admin routes require the correct code in the URL
3. **Environment Variable**: The code is stored in environment variables, not hardcoded
4. **Automatic Link Updates**: All internal links automatically use the configured code
5. **Table Isolation**: Guests can only access their specific table via unique codes

## Public Routes

The following routes remain publicly accessible (as required by law):
- `/datenschutz` - Privacy Policy
- `/impressum` - Legal Notice

## Implementation Details

### File Structure
- **Protected Routes**: Located in `src/pages/[route]/[code].tsx`
- **Page Components**: Moved to `src/components/[Route]PageContent.tsx`
- **Access Control**: Each protected route validates the code before rendering

### How It Works

1. User accesses a protected route with a code (e.g., `/bar/V26K`)
2. The route component extracts the code from the URL
3. It compares the code with `process.env.NEXT_PUBLIC_ADMIN_CODE`
4. If valid: renders the page content
5. If invalid: shows "Access Denied" message

## Deployment Notes

When deploying to Vercel:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add `NEXT_PUBLIC_ADMIN_CODE` with your chosen code
4. Redeploy the application

The code will be automatically embedded in the build and used throughout the application.

## Best Practices

1. **Keep the code secret**: Only share with trusted staff
2. **Use a strong code**: Mix letters and numbers, make it unpredictable
3. **Rotate regularly**: Change the code periodically for security
4. **Monitor access**: Check logs for unauthorized access attempts
5. **Backup links**: Save the correct admin URLs in a secure location
