import {
  canManageDocument,
  defaultDocumentName,
  documentNameSchema,
  fileIssue,
  fileKindOf,
  fileSizeText,
} from 'schemas/tripDocuments'

const MB = 1024 * 1024

// backend specs/0037 RF-10, RF-11
describe('a file chosen on the phone', () => {
  test('a photo of any kind, or a PDF, even without its type', () => {
    expect(fileKindOf({ name: 'a.heic', type: 'image/heic' })).toBe('photo')
    expect(fileKindOf({ name: 'a.pdf', type: 'application/pdf' })).toBe('pdf')
    expect(fileKindOf({ name: 'Carta.PDF', type: '' })).toBe('pdf')
    expect(
      fileKindOf({
        name: 'a.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    ).toBeNull()
  })

  test('what stops it, and why', () => {
    const pdf = (size: number) => ({
      name: 'a.pdf',
      type: 'application/pdf',
      size,
    })
    expect(fileIssue(pdf(MB), 0)).toBeNull()
    expect(fileIssue(pdf(12 * MB), 0)).toBe('El PDF pesa más de 10 MB.')
    expect(fileIssue({ name: 'a.docx', type: 'text/plain', size: 10 }, 0)).toBe(
      'Solo se aceptan fotos y PDF.'
    )
    expect(fileIssue(pdf(MB), 30)).toBe('Este viaje ya tiene 30 documentos.')
    // A big photo is compressed on the phone: it is not stopped here
    expect(
      fileIssue({ name: 'a.jpg', type: 'image/jpeg', size: 8 * MB }, 0)
    ).toBeNull()
  })

  test('its first name: the file, or the moment of a photo just taken', () => {
    const now = new Date(2026, 9, 9, 14, 32)
    expect(defaultDocumentName({ name: 'Factura 1234.pdf' }, false, now)).toBe(
      'Factura 1234'
    )
    expect(defaultDocumentName({ name: 'image.jpg' }, true, now)).toBe(
      'Foto del 9 oct, 14:32'
    )
    expect(defaultDocumentName({ name: '.pdf' }, false, now)).toBe(
      'Foto del 9 oct, 14:32'
    )
    expect(
      defaultDocumentName({ name: `${'x'.repeat(100)}.pdf` }, false, now)
    ).toHaveLength(80)
  })

  test('its size, as people read it', () => {
    expect(fileSizeText(300 * 1024)).toBe('300 KB')
    expect(fileSizeText(1.2 * MB)).toBe('1.2 MB')
    expect(fileSizeText(10)).toBe('1 KB')
  })

  test('a name is needed, up to 80', () => {
    expect(documentNameSchema.safeParse({ name: '  ' }).success).toBe(false)
    expect(documentNameSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(
      false
    )
    expect(documentNameSchema.parse({ name: ' Guía ' })).toEqual({
      name: 'Guía',
    })
  })
})

// RF-4
test('the owner and the supervisor manage any; a driver only theirs', () => {
  const byDan = { createdBy: 'dan' }
  expect(canManageDocument('owner', 'alice', byDan)).toBe(true)
  expect(canManageDocument('supervisor', 'sam', byDan)).toBe(true)
  expect(canManageDocument('driver', 'dan', byDan)).toBe(true)
  expect(canManageDocument('driver', 'dora', byDan)).toBe(false)
  expect(canManageDocument('viewer', 'dan', byDan)).toBe(false)
})
