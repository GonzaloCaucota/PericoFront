import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Chofer } from './chofer';

describe('Chofer', () => {
  let component: Chofer;
  let fixture: ComponentFixture<Chofer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Chofer],
    }).compileComponents();

    fixture = TestBed.createComponent(Chofer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
