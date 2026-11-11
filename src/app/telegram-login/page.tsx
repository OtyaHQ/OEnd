import { redirect } from 'next/navigation'

export default function TelegramLoginPage() {
  redirect('/sign-in?telegram=disabled')
}
