import * as React from "react"
import { cn } from "cn"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"

function Form({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      data-slot="form"
      className={cn("flex w-full flex-col gap-6", className)}
      {...props}
    />
  )
}

const FormField = Field
const FormLabel = FieldLabel
const FormDescription = FieldDescription
const FormMessage = FieldError
const FormGroup = FieldGroup
const FormLegend = FieldLegend
const FormSet = FieldSet

export {
  Form,
  FormDescription,
  FormField,
  FormGroup,
  FormLabel,
  FormLegend,
  FormMessage,
  FormSet,
}
