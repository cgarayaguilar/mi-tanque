import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'

/**
 * Google's required text when the reCAPTCHA badge is hidden (backend
 * specs/0008 RF-12). Shown where App Check or phone sign-in runs.
 */
export default function RecaptchaNotice() {
  return (
    <Typography
      variant="caption"
      component="p"
      sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}
    >
      Protegido por reCAPTCHA. Aplican la{' '}
      <Link
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        color="inherit"
      >
        Política de privacidad
      </Link>{' '}
      y los{' '}
      <Link
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        color="inherit"
      >
        Términos del servicio
      </Link>{' '}
      de Google.
    </Typography>
  )
}
