
import * as _ from 'lodash';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LocalStorage } from 'ngx-webstorage';

import { ModalController, PopoverController } from '@ionic/angular';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';

import { DataService } from '../data.service';
import { Character } from '../models/character';
import { CharacterSortPopover, CharacterModal } from './character-list.ui';

@Component({
  selector: 'app-character-list',
  templateUrl: 'character-list.page.html',
  styleUrls: ['character-list.page.scss']
})
export class CharacterListPage implements OnInit, OnDestroy {

  public isError: boolean;
  public allCharacters: Character[] = [];

  @LocalStorage()
  public sorting: 'tier'|'alpha'|'weapon';

  public tierSortedCharacters: { [key: string]: Character[] } = {};
  public allTiers: string[] = [];

  public alphaSortedCharacters: Character[] = [];

  public weaponSortedCharacters: { [key: string]: Character[] } = {};
  public allWeapons: string[] = [];

  public showSearch: boolean;
  public searchValue = '';

  private character$: Subscription;
  private hasModal: boolean;

  constructor(
    private dataService: DataService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private popoverCtrl: PopoverController,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    if(!this.sorting) { this.sorting = 'alpha'; }

    this.router.events
      .pipe(
        filter(x => x instanceof NavigationEnd)
      )
      .subscribe((x: NavigationEnd) => {
        this.updateCharacterList();
      });

    this.character$ = this.dataService.characters$.subscribe(chars => {
      this.allCharacters = chars;
      this.updateCharacterList();
    });
  }

  ngOnDestroy() {
    this.character$.unsubscribe();
  }

  public convertWeaponType(type: string): string {
    return this.dataService.properifyItem(type);
  }

  public loadCharacter(char: Character) {

    if(char.name === this.getPreviouslyLoadedChar()) {
      this.loadCharacterModal(char.name);
      return;
    }

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        filter: this.getCurrentFilter(),
        char: char.name
      }
    });
  }

  // UI MODIFYING FUNCTIONS
  public async loadCharacterModal(name: string) {
    if(this.hasModal) { return; }

    const character = _.find(this.allCharacters, { name });

    this.hasModal = true;

    const modal = await this.modalCtrl.create({
      component: CharacterModal,
      componentProps: {
        character,
        weapon: this.convertWeaponType(character.weapon)
      }
    });

    modal.onDidDismiss().then(() => this.hasModal = false);

    await modal.present();
  }

  public async openSort(ev) {
    const popover = await this.popoverCtrl.create({
      component: CharacterSortPopover,
      event: ev,
      translucent: true
    });

    popover.onDidDismiss().then(({ data }) => {
      if(!data) { return; }
      this.sorting = <'tier'|'alpha'|'weapon'>data;
    });

    return await popover.present();
  }

  public toggleSearch() {
    this.showSearch = !this.showSearch;

    if(!this.showSearch) {
      this.closeSearch();
    }
  }

  public updateSearchValue(ev) {
    if(!ev.detail) {
      this.searchValue = '';
      return;
    }
    const str = ev.detail.data;
    this.searchValue = str;
  }

  public closeSearch() {
    this.showSearch = false;
    this.searchValue = '';
  }

  // CHARACTER LIST SORTING
  private updateCharacterList() {
    let arr = this.allCharacters;

    const curFilter = this.getCurrentFilter();
    if(curFilter) {
      arr = this.allCharacters.filter(char => char.type === curFilter);
    }

    if(arr.length === 0) {
      this.isError = true;
      return;
    }

    this.isError = false;

    // alpha sorting
    this.alphaSortedCharacters = _.sortBy(arr, 'name');

    // weapon sorting
    this.weaponSortedCharacters = _(arr)
      .sortBy(arr, 'name')
      .groupBy('weapon')
      .value();
    this.allWeapons = _.sortBy(Object.keys(this.weaponSortedCharacters));

    // tier sorting
    this.tierSortedCharacters = _(arr)
      .sortBy([(char) => -char.rating, 'name'])
      .groupBy(char => {
        if(char.rating >= 10) { return 'Top Tier (10/10)'; }
        if(char.rating >= 8 && char.rating <= 9) { return 'Great (8-9/10)'; }
        if(char.rating >= 6 && char.rating <= 7) { return 'Good (6-7/10)'; }
        if(char.rating >= 4 && char.rating <= 3) { return 'Average (4-5/10)'; }
        return 'Bad (1-3/10)';
      })
      .value();
    this.allTiers = _.sortBy(Object.keys(this.tierSortedCharacters), (tier) => {
      if(tier === 'Top Tier (10/10)') { return 0; }
      if(tier === 'Great (8/9-10)')   { return 1; }
      if(tier === 'Good (6-7/10)')    { return 2; }
      if(tier === 'Average (4/5-10)') { return 3; }
      if(tier === 'Bad (1-3/10)')     { return 4; }
      return 10;
    });

    if(this.getPreviouslyLoadedChar()) {
      this.loadCharacterModal(this.getPreviouslyLoadedChar());
    }
  }

  private getCurrentFilter(): string {
    const parameters = new URLSearchParams(window.location.search);
    return parameters.get('filter');
  }

  private getPreviouslyLoadedChar(): string {
    const parameters = new URLSearchParams(window.location.search);
    return parameters.get('char');
  }
}
