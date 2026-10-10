export function AnnouncementBar({ message }: { message: string }) {
  return (
    <div className="bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
      {message}
    </div>
  );
}
