import { useRef } from 'react'

const PREDEFINED = [
  '/avatars/avatar-1.svg',
  '/avatars/avatar-2.svg',
  '/avatars/avatar-3.svg',
  '/avatars/avatar-4.svg',
  '/avatars/avatar-5.svg',
]

interface Props {
  value: string
  onChange: (url: string) => void
}

export default function AvatarPicker({ value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') onChange(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {PREDEFINED.map((src) => (
        <button
          key={src}
          type="button"
          onClick={() => onChange(src)}
          className={`rounded-full overflow-hidden transition-all focus:outline-none
            ${value === src ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-gray-900' : 'opacity-70 hover:opacity-100'}`}
        >
          <img src={src} alt="Avatar" className="w-14 h-14 object-cover" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`w-14 h-14 rounded-full border-2 border-dashed flex flex-col items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-xs gap-0.5
          ${!PREDEFINED.includes(value) && value ? 'border-blue-500 ring-4 ring-blue-500 ring-offset-2 ring-offset-gray-900' : 'border-gray-600'}`}
      >
        {!PREDEFINED.includes(value) && value ? (
          <img src={value} alt="Avatar personalizado" className="w-full h-full rounded-full object-cover" />
        ) : (
          <>
            <span className="text-lg leading-none">+</span>
            <span>Subir</span>
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
