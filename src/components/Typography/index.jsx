import {
  Figure,
  FigureLg,
  FigureSm,
  Title,
  Title2,
  Title3,
  Link,
  Link2,
  Body,
  Caption,
  Caption2,
} from './styles'

export default function Typography({ value, color, variant, mt, mb, ml, mr }) {
  switch (variant.toLowerCase()) {
    case 'figurelg':
      return (
        <FigureLg mt={mt} ml={ml} mr={mr} mb={mb} color={color}>
          {value}
        </FigureLg>
      )

    case 'figure':
      return (
        <Figure mt={mt} ml={ml} mr={mr} mb={mb} color={color}>
          {value}
        </Figure>
      )

    case 'figuresm':
      return (
        <FigureSm mt={mt} ml={ml} mr={mr} mb={mb} color={color}>
          {value}
        </FigureSm>
      )

    case 'title':
      return (
        <Title mt={mt} ml={ml} mr={mr} mb={mb} color={color}>
          {value}
        </Title>
      )

    case 'title2':
      return (
        <Title2 mt={mt} mb={mb} ml={ml} mr={mr} color={color}>
          {value}
        </Title2>
      )

    case 'title3':
      return (
        <Title3 mt={mt} mb={mb} ml={ml} mr={mr} color={color}>
          {value}
        </Title3>
      )

    case 'link':
      return (
        <Link mt={mt} mb={mb} ml={ml} mr={mr} color={color}>
          {value}
        </Link>
      )
    case 'link2':
      return (
        <Link2 mt={mt} mb={mb} ml={ml} mr={mr} color={color}>
          {value}
        </Link2>
      )

    case 'body':
      return (
        <Body mt={mt} mb={mb} ml={ml} mr={mr} color={color}>
          {value}
        </Body>
      )

    case 'caption':
      return (
        <Caption mt={mt} mb={mb} ml={ml} mr={mr} color={color}>
          {value}
        </Caption>
      )
    case 'caption2':
      return (
        <Caption2 mt={mt} mb={mb} ml={ml} mr={mr} color={color}>
          {value}
        </Caption2>
      )

    default:
      return (
        <Body mt={mt} mb={mb} ml={ml} mr={mr} color={color}>
          {value}
        </Body>
      )
  }
}
