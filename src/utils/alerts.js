import Swal from 'sweetalert2'

export const validationAlert = message => {
  return Swal.fire({
    icon: 'error',
    title: 'Completa los campos',
    text: message,
  })
}

export const successAlert = message => {
  return Swal.fire({
    position: 'top-end',
    icon: 'success',
    title: message,
    showConfirmButton: false,
    timer: 1500,
  })
}

export const updateAvailableAlert = () => {
  return Swal.fire({
    icon: 'info',
    title: 'Nueva versión disponible',
    text: '¿Quieres actualizar la app ahora?',
    showCancelButton: true,
    confirmButtonText: 'Actualizar',
    cancelButtonText: 'Más tarde',
    confirmButtonColor: '#00A8CC',
  })
}

export const offlineReadyAlert = () => {
  return Swal.fire({
    toast: true,
    position: 'bottom',
    icon: 'success',
    title: 'Lista para usarse sin conexión',
    showConfirmButton: false,
    timer: 2500,
  })
}
