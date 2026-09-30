import React from 'react'
import PropTypes from 'prop-types'
import {
  Title,
  Title2,
  Title3,
  Link,
  Link2,
  Body,
  Caption,
  Caption2,
} from './styles'

export default function Typography({
  value,
  color,
  variant,
  mt,
  mb,
  ml,
  mr,
  onClick,
}) {
  switch (variant.toLowerCase()) {
    case 'title':
      return (
        <Title mt={mt} ml={ml} mr={mr} mb={mb} color={color} onClick={onClick}>
          {value}
        </Title>
      )

    case 'title2':
      return (
        <Title2 mt={mt} mb={mb} ml={ml} mr={mr} color={color} onClick={onClick}>
          {value}
        </Title2>
      )

    case 'title3':
      return (
        <Title3 mt={mt} mb={mb} ml={ml} mr={mr} color={color} onClick={onClick}>
          {value}
        </Title3>
      )

    case 'link':
      return (
        <Link mt={mt} mb={mb} ml={ml} mr={mr} color={color} onClick={onClick}>
          {value}
        </Link>
      )
    case 'link2':
      return (
        <Link2 mt={mt} mb={mb} ml={ml} mr={mr} color={color} onClick={onClick}>
          {value}
        </Link2>
      )

    case 'body':
      return (
        <Body mt={mt} mb={mb} ml={ml} mr={mr} color={color} onClick={onClick}>
          {value}
        </Body>
      )

    case 'caption':
      return (
        <Caption
          mt={mt}
          mb={mb}
          ml={ml}
          mr={mr}
          color={color}
          onClick={onClick}
        >
          {value}
        </Caption>
      )
    case 'caption2':
      return (
        <Caption2
          mt={mt}
          mb={mb}
          ml={ml}
          mr={mr}
          color={color}
          onClick={onClick}
        >
          {value}
        </Caption2>
      )

    default:
      return (
        <Body mt={mt} mb={mb} ml={ml} mr={mr} color={color} onClick={onClick}>
          {value}
        </Body>
      )
  }
}

Typography.propTypes = {
  value: PropTypes.string.isRequired,
  variant: PropTypes.string.isRequired,
  color: PropTypes.string,
  mt: PropTypes.string,
  mb: PropTypes.string,
  ml: PropTypes.string,
  mr: PropTypes.string,
}
