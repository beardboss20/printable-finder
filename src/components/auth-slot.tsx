import { Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return <div className="size-9 animate-pulse rounded-full bg-elevated" />;
  }

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link to="/login">Sign in</Link>
      </Button>
    );
  }

  const label = user.displayName ?? user.primaryEmail ?? "Account";

  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="size-8 rounded-full object-cover"
        />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-elevated text-xs font-medium">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        className="hidden text-sm text-muted underline-offset-4 hover:text-fg hover:underline sm:inline"
      >
        Sign out
      </button>
    </div>
  );
}
