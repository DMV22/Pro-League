/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import axe from "axe-core"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ErrorState, LoadingState } from "@/components/ui/feedback-state"
import {
  Form,
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function PrimitiveFixture() {
  return (
    <main>
      <Card>
        <CardHeader>
          <CardTitle>Сезон 2026</CardTitle>
          <CardDescription>Демонстрація нейтральних UI-примітивів.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Badge>Опубліковано</Badge>
          <Button type="button" disabled>
            Недоступна дія
          </Button>

          <Form aria-label="Демонстраційна форма">
            <FormField data-invalid="true">
              <FormLabel htmlFor="competition-name">Назва змагання</FormLabel>
              <Input
                id="competition-name"
                aria-invalid="true"
                aria-describedby="competition-description competition-error"
              />
              <FormDescription id="competition-description">
                Назва відображатиметься у публічному порталі.
              </FormDescription>
              <FormMessage id="competition-error">Вкажіть назву.</FormMessage>
            </FormField>
          </Form>

          <Select>
            <SelectTrigger aria-label="Оберіть сезон">
              <SelectValue placeholder="Оберіть сезон" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>

          <Tabs defaultValue="overview">
            <TabsList aria-label="Розділи сезону">
              <TabsTrigger value="overview">Огляд</TabsTrigger>
              <TabsTrigger value="matches">Матчі</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Огляд сезону</TabsContent>
            <TabsContent value="matches">Перелік матчів</TabsContent>
          </Tabs>

          <Table>
            <TableCaption>Тестова таблиця команд</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Команда</TableHead>
                <TableHead scope="col">Очки</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Приклад</TableCell>
                <TableCell>3</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <LoadingState label="Завантаження даних" />
          <ErrorState title="Помилка" description="Повторіть спробу." />
        </CardContent>
      </Card>
    </main>
  )
}

describe("UI primitives", () => {
  it("has no detectable accessibility violations in shared states and controls", async () => {
    const { container } = render(<PrimitiveFixture />)

    const results = await axe.run(container, {
      rules: {
        // JSDOM has no canvas implementation; contrast is covered by browser checks.
        "color-contrast": { enabled: false },
      },
    })

    expect(results.violations).toHaveLength(0)
  })

  it("supports keyboard navigation between tabs", async () => {
    const user = userEvent.setup()
    render(<PrimitiveFixture />)

    const overviewTab = screen.getByRole("tab", { name: "Огляд" })
    const matchesTab = screen.getByRole("tab", { name: "Матчі" })

    overviewTab.focus()
    await user.keyboard("{ArrowRight}")

    expect(matchesTab).toHaveFocus()
    expect(matchesTab).toHaveAttribute("aria-selected", "true")
  })

  it("opens and dismisses a labelled dialog with the keyboard", async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button">Відкрити діалог</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Підтвердження</DialogTitle>
          <DialogDescription>Перевірте дані перед продовженням.</DialogDescription>
        </DialogContent>
      </Dialog>,
    )

    await user.click(screen.getByRole("button", { name: "Відкрити діалог" }))
    expect(screen.getByRole("dialog", { name: "Підтвердження" })).toBeVisible()

    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
