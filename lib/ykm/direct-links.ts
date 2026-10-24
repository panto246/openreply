// YKM fork addition: DM link buttons point straight at the destination (Drive
// PDF, workshop page) instead of the /r and /f redirects on this app's domain.
// On some Turkish mobile networks *.vercel.app fails with "this site's
// security certificate is not trusted" inside Instagram's browser, so anyone
// on those networks could not open the PDF or the workshop link at all.
// Taps are no longer counted here; workshop visits are still attributed by the
// UTM tags on the link. Set YKM_TRACKED_LINKS=1 to route through the redirects
// again (e.g. once the app has its own custom domain).
export const YKM_DIRECT_LINKS = process.env.YKM_TRACKED_LINKS !== "1";
