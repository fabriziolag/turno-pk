import type { DB } from '../lib/types'
import { startOfWeek, weekKey } from '../lib/dates'

/** Datos demo (el turno real de los screenshots), igual que seedDemo() del HTML. */
export function seedDB(): DB {
  const R = 'Metropolitana de Santiago'
  const C = 'Lo Barnechea'

  const families: DB['families'] = [
    {
      id: 'f_balut', kidName: 'Matilde', famName: 'Balut', kidPhoto: '',
      parents: [
        { name: 'Andrés Balut', role: 'papá', phone: '', email: '', photo: '' },
        { name: 'Javiera', role: 'mamá', phone: '', email: '', photo: '' },
      ],
      addresses: [
        { label: 'Casa', text: 'Camino La Cumbre 5066', region: R, comuna: C, extra: '', housePhoto: '', lat: -33.3302, lng: -70.5093 },
      ],
      contacts: [],
    },
    {
      id: 'f_ortuzar', kidName: 'Benjamín', famName: 'Ortuzar', kidPhoto: '',
      parents: [
        { name: '', role: 'papá', phone: '', email: '', photo: '' },
        { name: '', role: 'mamá', phone: '', email: '', photo: '' },
      ],
      addresses: [
        { label: 'Casa', text: 'Basel 4663', region: R, comuna: C, extra: 'casa T', housePhoto: '', lat: -33.3295, lng: -70.5141 },
      ],
      contacts: [],
    },
    {
      id: 'f_heusser', kidName: 'Colomba', famName: 'Heusser', kidPhoto: '',
      parents: [
        { name: '', role: 'papá', phone: '', email: '', photo: '' },
        { name: '', role: 'mamá', phone: '', email: '', photo: '' },
      ],
      addresses: [
        { label: 'Casa', text: 'Vaduz 4880', region: R, comuna: C, extra: '', housePhoto: '', lat: -33.3247, lng: -70.5163 },
      ],
      contacts: [],
    },
    {
      id: 'f_alvarez', kidName: 'Baltazar', famName: 'Álvarez', kidPhoto: '',
      parents: [
        { name: 'Fabrizio Álvarez', role: 'papá', phone: '', email: '', photo: '' },
        { name: 'María Ignacia Meyerholz', role: 'mamá', phone: '', email: '', photo: '' },
      ],
      addresses: [
        { label: 'Casa', text: 'Camino del Fundador 12973', region: R, comuna: C, extra: '', housePhoto: '', lat: -33.3496, lng: -70.5208 },
      ],
      contacts: [],
    },
  ]

  const wk = weekKey(startOfWeek(new Date()))

  return {
    families,
    schedule: {
      [wk]: {
        blocked: false,
        label: '',
        days: {
          lun: { kids: ['f_balut', 'f_heusser', 'f_alvarez', 'f_ortuzar'], driver: 'f_alvarez' },
          mar: { kids: ['f_balut', 'f_alvarez', 'f_ortuzar'], driver: 'f_ortuzar' },
          mie: { kids: ['f_balut', 'f_heusser', 'f_alvarez', 'f_ortuzar'], driver: 'f_heusser' },
          jue: { kids: ['f_heusser', 'f_alvarez', 'f_ortuzar'], driver: 'f_alvarez' },
          vie: { kids: ['f_balut', 'f_heusser', 'f_alvarez', 'f_ortuzar'], driver: 'f_balut' },
        },
      },
    },
    confirm: {},
    exitTimes: { lun: '13:20', mar: '13:20', mie: '14:00', jue: '13:20', vie: '13:20' },
    routeState: {},
    school: {
      name: 'Colegio Saint George', text: '', region: R, comuna: 'Vitacura', extra: '',
      lat: -33.386338475417396, lng: -70.60081184736576,
    },
    manualOrder: null,
  }
}
