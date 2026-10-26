/** Server-resolved identity context, not a capability or proof of current authorization. */
export type AdminActor = Readonly<{
  kind: 'admin'
  adminIdentityId: string
  accessGrantId: string
  sessionId: string
}>

/** Only a trusted operator/job/webhook adapter may select System execution. */
export type SystemActor = Readonly<{
  kind: 'system'
  operation: string
}>

export type CommandActor = AdminActor | SystemActor

/** Created on the server separately from command input; never spread from browser data. */
export type CommandContext<TActor extends CommandActor = CommandActor> = Readonly<{
  actor: TActor
  correlationKey: string
  causationKey?: string
}>
