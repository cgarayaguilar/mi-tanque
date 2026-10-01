import Typography from 'components/Typography'
import { space } from 'theme/tokens'
import { px } from 'styles/type'

export default function TextGroup({
  label,
  value,
  caption = null,
  size = 'medium',
}) {
  return (
    <div>
      <Typography value={`${label}`} variant="caption2" mb={px(space.xxs)} />
      <Typography
        value={`${value}`}
        variant={size === 'small' ? 'figureSm' : 'figure'}
      />
      {caption && <Typography value={`${caption}`} variant="caption" />}
    </div>
  )
}
