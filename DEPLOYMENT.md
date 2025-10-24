# Deployment Guide - Task Manager Pro

## Pre-Deployment Checklist

- [ ] All SQL scripts run successfully
- [ ] Supabase credentials updated
- [ ] Test login works (admin & user)
- [ ] Test create task works
- [ ] Test task assignment works
- [ ] All pages load correctly
- [ ] Responsive design tested on mobile

## Deploy to Netlify

### Option 1: GitHub Integration (Recommended)

1. Push code to GitHub
2. Go to https://app.netlify.com
3. Click "New site from Git"
4. Select GitHub and authorize
5. Choose repository
6. Configure:
   - Build command: (leave empty)
   - Publish directory: \public\
7. Click Deploy

### Option 2: Manual Deploy

1. Install Netlify CLI: \
pm install -g netlify-cli\
2. Run: \
etlify deploy --prod --dir=public\
3. Follow prompts

## Deploy to Vercel

1. Go to https://vercel.com
2. Click "New Project"
3. Import from Git
4. Configure project:
   - Framework: Other
   - Root Directory: ./
5. Set environment variables (if needed)
6. Deploy!

## Environment Variables

None required for basic deployment (all config in supabaseClient.js)

If using .env files in future:
- \VITE_SUPABASE_URL\
- \VITE_SUPABASE_ANON_KEY\

## Domain Setup

### Add Custom Domain (Netlify)

1. Go to Site settings ? Domain management
2. Click "Add domain"
3. Enter your domain name
4. Follow DNS setup instructions
5. SSL certificate auto-generated

### SSL/HTTPS

- Netlify: Automatic
- Vercel: Automatic
- Custom domain: Automatic with Let's Encrypt

## Database Backups

### Supabase Auto-Backups

- Daily backups enabled by default
- 7-day retention on free tier
- Restore from dashboard

### Manual Backup

1. Go to Supabase Dashboard ? Database
2. Click "Backups"
3. Click "Create backup"

## Monitoring

### Uptime Monitoring

Use UptimeRobot (free):
1. Go to https://uptimerobot.com
2. Add your site URL
3. Set alert email

### Error Tracking

Consider adding Sentry:
1. Create account at https://sentry.io
2. Add to your project
3. Get alerts on errors

## Performance Optimization

### CDN

Netlify/Vercel provide automatic CDN caching:
- CSS/JS cached for 1 year (versioned)
- HTML cached for 0 seconds (always fresh)

### Lazy Loading

Already implemented:
- Images load on demand
- Pages load dynamically

## Scaling Considerations

### Free Tier Limits

**Netlify/Vercel:**
- 300GB bandwidth/month
- Unlimited sites
- Automatic scaling

**Supabase:**
- 500MB database
- 1GB file storage
- 2GB bandwidth
- Suitable for small teams (< 100 users)

### Upgrade to Pro

Supabase Pro: \/month
- 8GB database
- 100GB file storage
- 250GB bandwidth
- Priority support

## After Deployment

1. Test all features in production
2. Share with team
3. Monitor error logs
4. Gather feedback
5. Plan improvements

## Rollback

If something goes wrong:

**Netlify/Vercel:**
- Go to Deployments
- Click "Rollback" on previous version
- Immediate rollback

**Database:**
- Go to Supabase Backups
- Click "Restore from backup"
- Follow prompts

## SSL Certificate

Automatic for:
- Netlify domains (\*.netlify.app)
- Vercel domains (\*.vercel.app)
- Custom domains (free with Let's Encrypt)

No action needed!

## Next Steps

1. Share deployed URL with team
2. Create admin account
3. Create organization/room
4. Invite users with room code
5. Start using!
