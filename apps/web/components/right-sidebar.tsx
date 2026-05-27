import { Bell, Calendar, CheckSquare, User } from 'lucide-react';

export default function RightSidebar() {
  return (
    <div className="flex h-full w-14 shrink-0 flex-col items-center border-l border-gray-200 bg-white py-4 shadow-sm">
      <div className="flex flex-col gap-6">
        <button
          type="button"
          title="Calendar"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <Calendar className="h-5 w-5 text-blue-600" />
        </button>
        <button
          type="button"
          title="Tasks"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <CheckSquare className="h-5 w-5 text-yellow-500" />
        </button>
        <button
          type="button"
          title="People"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <User className="h-5 w-5 text-green-600" />
        </button>
        <div className="my-2 h-px w-8 bg-gray-200" />
        <button
          type="button"
          title="Alerts"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <Bell className="h-5 w-5 text-gray-500" />
        </button>
      </div>
    </div>
  );
}
