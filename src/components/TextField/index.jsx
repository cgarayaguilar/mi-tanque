import React from 'react'
import { MdSearch as SearchIcon } from 'react-icons/md'
import { Wrapper, TextFieldContainer, Label } from './styles'
import randomKey from 'utils/randomKey'

export default function TextField({
    label = null,
    placeholder,
    search = false,
    Icon = null,
    mt,
    mb,
    ml,
    mr,
    onClick = () => {},
    ...rest
}) {
    const key = randomKey()

    return (
        <Wrapper mt={mt} ml={ml} mr={mr} mb={mb} onClick={onClick}>
            {label && <Label htmlFor={key}>{label}</Label>}
            <TextFieldContainer>
                <input
                    type="text"
                    placeholder={placeholder}
                    id={key}
                    {...rest}
                />
                {search && !Icon && <SearchIcon size={24} />}
                {Icon && <Icon size={24} />}
            </TextFieldContainer>
        </Wrapper>
    )
}
