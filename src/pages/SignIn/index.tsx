import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import GoogleIcon from '@mui/icons-material/Google'
import SelectField from 'components/SelectField'
import TextField from 'components/TextField'
import { useOnlineStatus } from 'hooks/useOnlineStatus'
import {
  codeFormSchema,
  phoneFormSchema,
  type CodeFormValues,
  type PhoneFormValues,
} from 'schemas/account'
import {
  sendPhoneCode,
  signInWithGoogle,
  type PhoneVerification,
} from 'services/session'
import { useSessionStore } from 'store/session'
import {
  authErrorMessage,
  isCancelledSignIn,
  isWrongCode,
} from 'utils/authErrors'
import {
  defaultPhoneCountry,
  findPhoneCountry,
  PHONE_COUNTRIES,
  toE164,
} from 'utils/phoneCountries'
import { reportError } from 'utils/reportError'

const RESEND_AFTER_SECONDS = 60

const COUNTRY_OPTIONS = PHONE_COUNTRIES.map(country => ({
  value: country.code,
  label: `${country.name} (+${country.dialCode})`,
}))

const reportSignInError = (error: unknown, operation: string) => {
  reportError(error, { operation })
  sileo.error({
    title: 'No pudimos iniciar sesión',
    description: authErrorMessage(error),
  })
}

interface CodeStepProps {
  phone: string
  verification: PhoneVerification
  onResend: () => Promise<void>
  onChangeNumber: () => void
}

function CodeStep({
  phone,
  verification,
  onResend,
  onChangeNumber,
}: CodeStepProps) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormValues>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: '' },
  })

  useEffect(() => {
    if (secondsLeft === 0) return
    const timer = setTimeout(() => {
      setSecondsLeft(seconds => seconds - 1)
    }, 1000)
    return () => {
      clearTimeout(timer)
    }
  }, [secondsLeft])

  const onSubmit = async ({ code }: CodeFormValues) => {
    try {
      await verification.confirm(code)
      // The session store follows the auth state and the page redirects
    } catch (error) {
      if (isWrongCode(error)) {
        setError('code', { message: authErrorMessage(error) })
        return
      }
      reportSignInError(error, 'confirmPhoneCode')
    }
  }

  const resend = async () => {
    setSecondsLeft(RESEND_AFTER_SECONDS)
    await onResend()
  }

  return (
    <Box
      component="form"
      noValidate
      aria-label="Código de verificación"
      onSubmit={event => {
        void handleSubmit(onSubmit)(event)
      }}
    >
      <Typography variant="body2" sx={{ mb: 4 }}>
        Escribe el código que enviamos por SMS al <strong>{phone}</strong>.
      </Typography>
      <TextField
        id="code"
        label="Código"
        placeholder="123456"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={errors.code?.message}
        registration={register('code')}
      />
      <Stack spacing={3} sx={{ mt: 4 }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          loading={isSubmitting}
          loadingPosition="start"
        >
          {isSubmitting ? 'Verificando…' : 'Verificar'}
        </Button>
        <Button
          disabled={secondsLeft > 0}
          onClick={() => {
            void resend()
          }}
        >
          {secondsLeft > 0
            ? `Reenviar código en ${String(secondsLeft)} s`
            : 'Reenviar código'}
        </Button>
        <Button onClick={onChangeNumber}>Cambiar número</Button>
      </Stack>
    </Box>
  )
}

export default function SignIn() {
  const status = useSessionStore(state => state.status)
  const start = useSessionStore(state => state.start)
  const [, navigate] = useLocation()
  const online = useOnlineStatus()
  const recaptchaRef = useRef<HTMLDivElement>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [sent, setSent] = useState<{
    phone: string
    verification: PhoneVerification
  } | null>(null)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: { country: defaultPhoneCountry().code, number: '' },
  })

  useEffect(() => {
    void start()
  }, [start])

  // Signed in (here or in another tab): go where the account needs to be
  useEffect(() => {
    if (status === 'ready') navigate('/', { replace: true })
    if (status === 'needsOnboarding') navigate('/bienvenida', { replace: true })
  }, [status, navigate])

  const continueWithGoogle = async () => {
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      if (!isCancelledSignIn(error)) reportSignInError(error, 'googleSignIn')
    } finally {
      setGoogleBusy(false)
    }
  }

  const sendCode = async ({ country, number }: PhoneFormValues) => {
    const phoneCountry = findPhoneCountry(country)
    if (!phoneCountry || !recaptchaRef.current) return
    const phone = toE164(phoneCountry, number)
    try {
      const verification = await sendPhoneCode(phone, recaptchaRef.current)
      setSent({ phone, verification })
    } catch (error) {
      reportSignInError(error, 'sendPhoneCode')
    }
  }

  return (
    <Box component="main" sx={{ p: 4, pb: 8 }}>
      <Typography variant="h3" component="h1">
        Entra a tu cuenta
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, mb: 6 }}>
        Guarda tus tanques y mediciones en la nube y compártelos con tu equipo.
      </Typography>

      {!online && (
        <Typography
          role="status"
          variant="body2"
          sx={{ mb: 4, color: 'error.main' }}
        >
          Sin conexión. Necesitas internet para entrar.
        </Typography>
      )}

      {sent ? (
        <CodeStep
          phone={sent.phone}
          verification={sent.verification}
          onResend={() => sendCode(getValues())}
          onChangeNumber={() => {
            setSent(null)
          }}
        />
      ) : (
        <>
          <Button
            variant="outlined"
            size="large"
            fullWidth
            startIcon={<GoogleIcon />}
            loading={googleBusy}
            loadingPosition="start"
            disabled={!online}
            onClick={() => {
              void continueWithGoogle()
            }}
          >
            Continuar con Google
          </Button>

          <Divider sx={{ my: 6 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              o con tu teléfono
            </Typography>
          </Divider>

          <Box
            component="form"
            noValidate
            aria-label="Entrar con tu teléfono"
            onSubmit={event => {
              void handleSubmit(sendCode)(event)
            }}
          >
            <Stack spacing={4}>
              <SelectField
                id="country"
                label="País"
                options={COUNTRY_OPTIONS}
                registration={register('country')}
              />
              <TextField
                id="phone"
                label="Número de teléfono"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="8888 7777"
                hint="Te enviaremos un código por SMS."
                error={errors.number?.message}
                registration={register('number')}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                loading={isSubmitting}
                loadingPosition="start"
                disabled={!online}
              >
                {isSubmitting ? 'Enviando…' : 'Enviar código'}
              </Button>
            </Stack>
          </Box>
        </>
      )}

      {/* Host of the invisible reCAPTCHA that protects the SMS (RF-3) */}
      <div ref={recaptchaRef} />

      <Button
        fullWidth
        sx={{ mt: 6 }}
        onClick={() => {
          navigate('/')
        }}
      >
        Seguir sin cuenta
      </Button>
    </Box>
  )
}
