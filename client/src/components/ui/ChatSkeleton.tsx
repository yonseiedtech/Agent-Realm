import { Skeleton } from "./skeleton";

export default function ChatSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Agent message 1 */}
      <div className="flex justify-start">
        <Skeleton className="w-9 h-9 rounded-full shrink-0 mr-3" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-16 w-56 rounded-2xl rounded-bl-md" />
        </div>
      </div>

      {/* User message */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-40 rounded-2xl rounded-br-md" />
      </div>

      {/* Agent message 2 */}
      <div className="flex justify-start">
        <Skeleton className="w-9 h-9 rounded-full shrink-0 mr-3" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-24 w-64 rounded-2xl rounded-bl-md" />
        </div>
      </div>
    </div>
  );
}
