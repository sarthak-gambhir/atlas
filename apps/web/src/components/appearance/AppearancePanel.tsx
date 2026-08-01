import {
  Button,
  Card,
  CardBody,
  Divider,
  Grid,
  Heading,
  Inline,
  Input,
  Stack,
  Text,
  ToggleGroup,
  ToggleGroupItem,
  palettes,
  paletteNames,
  useTheme,
  Box,
  FormField,
} from '@astrabound/duality';
import { RiCheckLine } from 'react-icons/ri';

export function AppearancePanel() {
  const { theme, density, texture, setTheme, setDensity, setTexture } = useTheme();

  return (
    <Stack gap={5}>
      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3} visualLevel={5}>
            Palette
          </Heading>
          <Text size="sm">
            Atlas draws everything in two colors. Pick the pair that is easiest on your eyes.
          </Text>
        </Stack>

        <Grid
          className="atlas-swatch-grid"
          minChildWidth={140}
          gap={3}
          role="group"
          aria-label="Palette"
        >
          {paletteNames.map((name) => {
            const palette = palettes[name];
            const active = theme === name;
            return (
              <button
                key={name}
                type="button"
                className="atlas-swatch"
                aria-pressed={active}
                aria-label={palette.label}
                style={{ background: palette.bg, color: palette.fg, borderColor: palette.fg }}
                onClick={() => setTheme(name)}
              >
                <span className="atlas-swatch-sample" aria-hidden>
                  Aa
                </span>
                <span className="atlas-swatch-label">
                  {palette.label}
                  {active ? <RiCheckLine aria-hidden /> : null}
                </span>
              </button>
            );
          })}
        </Grid>
      </Stack>

      <Divider />

      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3} visualLevel={5}>
            Density
          </Heading>
          <Text size="sm">Comfortable adds more breathing room; Compact tightens spacing.</Text>
        </Stack>
        <ToggleGroup
          type="single"
          label="Density"
          value={density}
          onValueChange={(value) => {
            if (value === 'comfortable' || value === 'compact') setDensity(value);
          }}
        >
          <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
          <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
        </ToggleGroup>
      </Stack>

      <Divider />

      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3} visualLevel={5}>
            Texture
          </Heading>
          <Text size="sm">The fill used on disabled and decorative surfaces.</Text>
        </Stack>
        <ToggleGroup
          type="single"
          label="Texture"
          value={texture}
          onValueChange={(value) => {
            if (value === 'dither' || value === 'hatch') setTexture(value);
          }}
        >
          <ToggleGroupItem value="dither">Dither</ToggleGroupItem>
          <ToggleGroupItem value="hatch">Hatch</ToggleGroupItem>
        </ToggleGroup>
      </Stack>

      <Divider />

      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3} visualLevel={5}>
            Preview
          </Heading>
          <Text size="sm">A quick sample of how components look with these settings.</Text>
        </Stack>

        <Card>
          <CardBody>
            <Stack gap={4}>
              <Stack gap={1}>
                <Heading level={4} visualLevel={4}>
                  Ship the roadmap
                </Heading>
                <Text size="sm">
                  The quick brown fox jumps over the lazy dog while the score ticks upward.
                </Text>
              </Stack>

              <Inline gap={2} align="center">
                <Button variant="solid">Solid</Button>
                <Button variant="inverse">Inverse</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="solid" disabled>
                  Disabled
                </Button>
              </Inline>

              <Box padding={1} border style={{ maxWidth: 540 }}>
                <FormField label="Sample input" hint="A plain text input for previewing the theme.">
                  <Input placeholder="A sample input" aria-label="Sample input" type="text" />
                </FormField>
              </Box>
            </Stack>
          </CardBody>
        </Card>
      </Stack>

      <Text size="sm">Appearance settings are saved to this browser, not your account.</Text>
    </Stack>
  );
}
