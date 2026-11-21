import { redirect } from 'next/navigation'

export default function AskRedirect(): never {
  redirect('/admin/ai')
}
