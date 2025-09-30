# Deployment Guide for VSIE

This guide provides step-by-step instructions for deploying the VSIE project to make it live.

## Prerequisites

Before deploying, ensure you have:
- Node.js 18+ installed
- A GitHub account
- (Optional) A Vercel account for serverless deployment
- (Optional) Supabase project for backend functionality

## Option 1: Deploy to GitHub Pages (Recommended for Static Site)

The project is already configured for GitHub Pages deployment via GitHub Actions.

### Steps:

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Enable GitHub Pages in your repository**:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under "Build and deployment", set **Source** to **GitHub Actions**
   - Ensure the default branch is set to `main`

3. **Configure Environment Variables** (Optional):
   If you're using Supabase or other services, configure them in **Settings** → **Secrets and variables** → **Actions**:
   
   **Variables** (not secrets):
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_BUCKET` - Storage bucket name (default: `attachments`)
   - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - reCAPTCHA site key (optional)
   
   **Secrets**:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

4. **Trigger Deployment**:
   - The GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically trigger on push to `main`
   - Go to the **Actions** tab to monitor the deployment progress
   - Once complete, your site will be live at: `https://<username>.github.io/<repository-name>/`

## Option 2: Deploy to Vercel (Recommended for Full Features)

Vercel provides seamless deployment with automatic builds and previews.

### Steps:

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Deploy via Vercel Dashboard**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure the project:
     - **Framework Preset**: Next.js
     - **Build Command**: `npm run build`
     - **Output Directory**: `out`
   
3. **Configure Environment Variables** in Vercel Dashboard:
   Navigate to **Project Settings** → **Environment Variables** and add:
   
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `NEXT_PUBLIC_SUPABASE_BUCKET` - Storage bucket name (default: `attachments`)
   - `NEXT_PUBLIC_RAZORPAY_KEY` - Razorpay key for payments (if using)
   - `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - reCAPTCHA site key (optional)
   
4. **Deploy**:
   - Click "Deploy"
   - Vercel will automatically build and deploy your site
   - Your site will be live at: `https://<project-name>.vercel.app`

### Deploy via CLI:
```bash
cd /path/to/VSIE
vercel
```

Follow the prompts to complete the deployment.

## Option 3: Deploy to Netlify

1. **Install Netlify CLI** (optional):
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy via Netlify Dashboard**:
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `out`

3. **Configure Environment Variables**:
   Add the same environment variables as listed for Vercel in **Site settings** → **Environment variables**

4. **Deploy**:
   - Click "Deploy site"
   - Your site will be live at: `https://<site-name>.netlify.app`

## Local Development

To run the project locally:

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The site will be available at `http://localhost:3000`

## Environment Variables Reference

### Required for Full Functionality:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key

### Optional:
- `NEXT_PUBLIC_BASE_PATH` - Base path for GitHub Pages (set automatically in CI)
- `NEXT_PUBLIC_SUPABASE_BUCKET` - Storage bucket name (default: `attachments`)
- `NEXT_PUBLIC_REG_FEE` - Registration fee amount (default: `0`)
- `NEXT_PUBLIC_RAZORPAY_KEY` - Razorpay key for payment integration
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - Google reCAPTCHA v3 site key
- `NEXT_PUBLIC_FORM_ENDPOINT` - Custom API endpoint for form submissions

## Post-Deployment Checklist

- [ ] Verify the site loads correctly
- [ ] Test navigation between pages
- [ ] Test form submissions (if using Supabase)
- [ ] Test admin login (if configured)
- [ ] Check that images and assets load properly
- [ ] Test responsive design on mobile devices
- [ ] Verify environment variables are set correctly
- [ ] Test payment integration (if enabled)

## Troubleshooting

### Build Failures
- Ensure all dependencies are installed: `npm install`
- Check that Node.js version is 18 or higher: `node --version`
- Verify environment variables are set correctly

### Supabase Issues
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Verify your Supabase project is active
- Check Row Level Security (RLS) policies if data isn't loading

### GitHub Pages 404 Errors
- Ensure `NEXT_PUBLIC_BASE_PATH` is set to `/your-repo-name` in the workflow
- Verify GitHub Pages is enabled in repository settings
- Check that the default branch is `main`

## Support

For issues or questions:
1. Check the existing documentation in the repository
2. Review the [Next.js documentation](https://nextjs.org/docs)
3. Consult the [Supabase documentation](https://supabase.com/docs) for backend issues
4. Open an issue in the GitHub repository

## Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Supabase Documentation](https://supabase.com/docs)
