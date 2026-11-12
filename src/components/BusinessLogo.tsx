import { logoUrl } from '@/lib/logo'

interface Props {
  path?: string | null
  name: string
  className?: string
}

/** Logo del negocio; si no tiene, no pinta nada. */
export default function BusinessLogo({ path, name, className = 'h-12 w-12' }: Props) {
  const src = logoUrl(path)
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`Logo de ${name}`} className={`${className} rounded-xl bg-white object-contain`} />
  )
}
