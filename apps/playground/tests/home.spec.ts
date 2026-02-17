import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("should increase counter", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("increase-times-clicked").click();
    const timesClicked = await page.getByTestId("times-clicked").getAttribute("data-times-clicked");
    expect(timesClicked).toBe("1");
  });

  test("should update pokemon gif", async ({ page }) => {
    const getPokemonImage = () => page.getByTestId("pokemon-image").getAttribute("src");
    await page.goto("/");
    const defaultPokemonImage = await getPokemonImage();
    const responsePromise = page.waitForResponse(/\.gif$/);
    await page.getByTestId("select-pokemon").selectOption("blastoise");
    await responsePromise;
    const updatedPokemonImage = await getPokemonImage();
    expect(updatedPokemonImage).toContain(".gif");
    expect(updatedPokemonImage).not.toEqual(defaultPokemonImage);
  });
});
