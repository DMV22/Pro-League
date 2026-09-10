# Use Clerk invite-only for Admin authentication

ProLeague will use Clerk in invite-only mode to authenticate Admin identities and manage credentials, sessions, recovery, and revocation instead of implementing those security-sensitive workflows in-house. The server-side application layer remains responsible for authorization: a valid Clerk identity gains administrative access only when it maps to an active Admin record in PostgreSQL, and public Visitor registration remains outside the launch scope.
