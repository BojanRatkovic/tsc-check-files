export interface TestInterface {
  name: string;
  value: number;
}

export function testFunction(param: TestInterface): string {
  return `${param.name}: ${param.value}`;
}

export const testConstant = "test" as const;
