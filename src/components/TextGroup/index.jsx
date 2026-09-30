import Typography from 'components/Typography'
import React from 'react'

export default function TextGroup({
  label,
  value,
  caption = null,
  size = 'medium',
}) {
  return (
    <div>
      <Typography
        value={`${label}`}
        variant={`${size === 'small' ? 'caption' : 'body'}`}
        mb="4px"
      />
      <Typography
        value={`${value}`}
        variant={`${size === 'small' ? 'title3' : 'title2'}`}
      />
      {caption && <Typography value={`${caption}`} variant="caption2" />}
    </div>
  )
}
